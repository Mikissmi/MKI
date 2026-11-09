"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optText, optUuid, tags, text } from "@/lib/schema-kit";
import { markNewsRead, markNewsUnread, saveNewsForLater, summarizeNewsWithAi, type AiSummaryResult } from "@/lib/news-read";
import { addFeed, refreshFeeds, retagNews } from "@/lib/news";
import type { FormState } from "@/lib/agenda/schemas";

const topic: CrudDef = { table: "topics", schema: z.object({ id, name: text(40), keywords: tags, tone: oneOf(["pink", "sage", "sun", "lavender"]) }) };
const done = () => revalidatePath("/", "layout");
const uuidOf = (f: FormData, k = "id") => z.string().uuid().safeParse(f.get(k));

export async function addFeedAction(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ url: z.string().trim().min(1, "Cole o endereço do site ou do feed").max(1000), topic_id: optUuid }).safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: parsed.error.issues[0].message, fieldErrors: { url: parsed.error.issues[0].message } };
  const url = /^https?:\/\//i.test(parsed.data.url) ? parsed.data.url : `https://${parsed.data.url}`;
  if (parsed.data.topic_id) {
    const own = await queryOne("SELECT 1 FROM topics WHERE id = $1 AND user_id = $2", [parsed.data.topic_id, u.id]);
    if (!own) return { error: "Tema inválido." };
  }
  const r = await addFeed(u.id, url, parsed.data.topic_id);
  if (!r.ok) return { error: r.error, fieldErrors: { url: r.error ?? "Erro" } };
  done();
  return { ok: true };
}

export async function addSuggestedFeed(f: FormData) {
  const u = await requireUser();
  const url = String(f.get("url") ?? "");
  if (/^https:\/\/(tecnoblog\.net|feeds\.bbci\.co\.uk|www\.quantamagazine\.org|aeon\.co)\//.test(url)) await addFeed(u.id, url, null);
  done();
}

export async function deleteFeed(f: FormData) { const u = await requireUser(); await removeRecord("feeds", f.get("id"), u.id); }
export async function toggleMuteFeed(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  await query("UPDATE feeds SET muted = NOT muted WHERE id = $1 AND user_id = $2", [id.data, u.id]); done();
}
export async function refreshNow() { const u = await requireUser(); await refreshFeeds(u.id, { force: true }); done(); }

export async function toggleRead(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  const n = await queryOne<{ read: boolean }>("SELECT read FROM news_items WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  if (!n) return;
  // lida = vira artigo lido em Leituras; desmarcar devolve o artigo para "quero ler"
  if (n.read) await markNewsUnread(u.id, id.data); else await markNewsRead(u.id, id.data);
  done();
}
export async function toggleFavorite(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  await query("UPDATE news_items SET favorite = NOT favorite WHERE id = $1 AND user_id = $2", [id.data, u.id]); done();
}
export async function markAllRead() { const u = await requireUser(); await query("UPDATE news_items SET read = true WHERE user_id = $1 AND NOT read", [u.id]); done(); }

/** "Salvar para ler depois": cria o artigo com status "quero ler" em Leituras (sem duplicar o mesmo link). */
export async function saveForLater(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  await saveNewsForLater(u.id, id.data);
  done();
}

/** Resumo com IA, sob demanda (usa o limite diário; sem IA o resumo simples continua). */
export async function summarizeWithAi(newsId: string): Promise<AiSummaryResult> {
  const u = await requireUser();
  const id = z.string().uuid().safeParse(newsId);
  if (!id.success) return { ok: false, error: "Matéria inválida." };
  const r = await summarizeNewsWithAi(u.id, id.data);
  done();
  return r;
}

/** Anotação sobre a matéria: fica nas anotações do artigo em Leituras (o artigo é criado como "quero ler" se ainda não existir). */
export async function noteForNews(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ news_id: z.string().uuid(), quote: optText(2000), note: optText(2000) }).safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Anotação inválida." };
  if (!parsed.data.quote && !parsed.data.note) return { error: "Escreva um trecho ou uma anotação.", fieldErrors: { quote: "Escreva um trecho ou uma anotação" } };
  if (!(await saveNewsForLater(u.id, parsed.data.news_id))) return { error: "Matéria não encontrada." };
  const item = await queryOne<{ reading_item_id: string }>("SELECT reading_item_id FROM news_items WHERE id = $1 AND user_id = $2", [parsed.data.news_id, u.id]);
  if (!item?.reading_item_id) return { error: "Não foi possível anotar." };
  await query("INSERT INTO reading_notes (user_id, item_id, quote, note) VALUES ($1,$2,$3,$4)", [u.id, item.reading_item_id, parsed.data.quote, parsed.data.note]);
  done();
  return { ok: true };
}

export async function saveTopic(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  try {
    const r = await saveRecord(topic, f, u.id);
    if (r.ok) await retagNews(u.id);
    return r;
  } catch { return { error: "Já existe um tema com esse nome.", fieldErrors: { name: "Nome já usado" } }; }
}
export async function deleteTopic(f: FormData) { const u = await requireUser(); await removeRecord("topics", f.get("id"), u.id); await retagNews(u.id); }
export async function addPresetTopic(f: FormData) {
  const u = await requireUser();
  const name = String(f.get("name") ?? ""), tone = String(f.get("tone") ?? "pink"), kw = String(f.get("keywords") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  if (!name || !["pink", "sage", "sun", "lavender"].includes(tone)) return;
  await query("INSERT INTO topics (user_id, name, keywords, tone) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, name) DO NOTHING", [u.id, name.slice(0, 40), kw, tone]);
  await retagNews(u.id);
  done();
}
