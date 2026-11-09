"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optUuid, tags, text } from "@/lib/schema-kit";
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
  await query("UPDATE news_items SET read = NOT read WHERE id = $1 AND user_id = $2", [id.data, u.id]); done();
}
export async function toggleFavorite(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  await query("UPDATE news_items SET favorite = NOT favorite WHERE id = $1 AND user_id = $2", [id.data, u.id]); done();
}
export async function markAllRead() { const u = await requireUser(); await query("UPDATE news_items SET read = true WHERE user_id = $1 AND NOT read", [u.id]); done(); }

/** "Salvar para ler depois": cria um artigo em Leituras (sem duplicar o mesmo link). */
export async function saveForLater(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  const n = await queryOne<{ title: string; link: string; image_url: string | null }>("SELECT title, link, image_url FROM news_items WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  if (!n) return;
  const exists = await queryOne("SELECT 1 FROM reading_items WHERE user_id = $1 AND kind = 'artigo' AND url = $2", [u.id, n.link]);
  if (!exists) await query("INSERT INTO reading_items (user_id, kind, title, url, cover_url, status, source) VALUES ($1,'artigo',$2,$3,$4,'quero','noticia')", [u.id, n.title.slice(0, 200), n.link, n.image_url]);
  await query("UPDATE news_items SET read = true WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  done();
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
