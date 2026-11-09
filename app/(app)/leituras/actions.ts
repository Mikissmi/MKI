"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optDate, optInt, optOneOf, optText, reqInt, tags, text, url, uuid } from "@/lib/schema-kit";
import { fetchLinkMeta } from "@/lib/safe-fetch";
import { localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const reading: CrudDef = {
  table: "reading_items",
  schema: z.object({
    id, kind: oneOf(["livro", "artigo", "obra"]), title: text(200), author: optText(120), status: oneOf(["quero", "lendo", "lido", "abandonado", "arquivado"]),
    serial_status: optOneOf(["em_dia", "aguardando", "pausada"]), current_page: optInt(0, 100000), total_pages: optInt(1, 100000), last_chapter: optText(80),
    url: url(), cover_url: url(), rating: optInt(1, 5), review: optText(4000), tags, minutes_hint: optInt(1, 600), started_on: optDate, finished_on: optDate,
  }),
};
const note: CrudDef = { table: "reading_notes", schema: z.object({ id, item_id: uuid, quote: optText(2000), note: optText(2000), page: optInt(0, 100000) }).refine((v) => v.quote || v.note, { path: ["quote"], message: "Escreva um trecho ou uma anotação" }) };

export async function saveReading(_p: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const data = new FormData();
  for (const [k, v] of f.entries()) data.append(k, v);
  const today = localDateKey();
  const kind = String(f.get("kind") ?? "");
  const link = String(f.get("url") ?? "").trim();
  // Artigo sem título: busca o título (e a imagem) do link no servidor, com proteção contra endereços internos.
  if (kind === "artigo" && !String(f.get("title") ?? "").trim()) {
    if (!link) return { error: "Informe o link do artigo.", fieldErrors: { url: "Informe o link" } };
    const meta = await fetchLinkMeta(link);
    data.set("title", meta.title ?? (() => { try { return new URL(link).hostname; } catch { return "Artigo"; } })());
    if (meta.image && !data.get("cover_url")) data.set("cover_url", meta.image);
  }
  const status = String(f.get("status") ?? "");
  if (status === "lido" && !data.get("finished_on")) data.set("finished_on", today);
  if (status === "lendo" && !data.get("started_on")) data.set("started_on", today);
  try {
    return await saveRecord(reading, data, user.id);
  } catch (e) {
    // índice único: um artigo por link
    if ((e as { code?: string }).code === "23505") return { error: "Este link já está salvo em Leituras.", fieldErrors: { url: "Este link já está salvo" } };
    throw e;
  }
}
export async function deleteReading(f: FormData) { const u = await requireUser(); await removeRecord("reading_items", f.get("id"), u.id); }
export async function saveNote(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(note, f, u.id); }
export async function deleteNote(f: FormData) { const u = await requireUser(); await removeRecord("reading_notes", f.get("id"), u.id); }

export async function setReadingStatus(f: FormData) {
  const user = await requireUser();
  const itemId = z.string().uuid().safeParse(f.get("id"));
  const status = z.enum(["quero", "lendo", "lido", "abandonado", "arquivado"]).safeParse(f.get("status"));
  if (!itemId.success || !status.success) return;
  await query(
    `UPDATE reading_items SET status = $3, finished_on = CASE WHEN $3 = 'lido' THEN COALESCE(finished_on, $4::date) ELSE finished_on END,
            started_on = CASE WHEN $3 = 'lendo' THEN COALESCE(started_on, $4::date) ELSE started_on END WHERE id = $1 AND user_id = $2`,
    [itemId.data, user.id, status.data, localDateKey()]);
  revalidatePath("/", "layout");
}

/** "Registrar leitura": soma as páginas ao progresso, guarda no histórico e conclui o livro ao chegar na última página. */
export async function logReading(_p: FormState, f: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z.object({ item_id: uuid, pages: reqInt(1, 5000), minutes: optInt(1, 1440) }).safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Informe quantas páginas você leu.", fieldErrors: { pages: "Informe as páginas (1 a 5000)" } };
  const { item_id, pages, minutes } = parsed.data;
  const today = localDateKey();
  const item = await queryOne<{ current_page: number | null; total_pages: number | null }>("SELECT current_page, total_pages FROM reading_items WHERE id = $1 AND user_id = $2", [item_id, user.id]);
  if (!item) return { error: "Leitura não encontrada." };
  const next = Math.min((item.current_page ?? 0) + pages, item.total_pages ?? Number.MAX_SAFE_INTEGER);
  const finished = item.total_pages !== null && next >= item.total_pages;
  await query("INSERT INTO reading_logs (user_id, item_id, date, pages, minutes) VALUES ($1,$2,$3::date,$4,$5)", [user.id, item_id, today, pages, minutes]);
  await query(
    `UPDATE reading_items SET current_page = $3, status = CASE WHEN $4 THEN 'lido' WHEN status IN ('quero') THEN 'lendo' ELSE status END,
            started_on = COALESCE(started_on, $5::date), finished_on = CASE WHEN $4 THEN COALESCE(finished_on, $5::date) ELSE finished_on END WHERE id = $1 AND user_id = $2`,
    [item_id, user.id, next, finished, today]);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Atalho do botão "+" (Link para ler depois): salva o link como artigo, com título automático. */
export async function saveLinkForLater(_p: FormState, f: FormData): Promise<FormState> {
  const data = new FormData();
  data.set("kind", "artigo"); data.set("status", "quero"); data.set("url", String(f.get("url") ?? "")); data.set("title", String(f.get("title") ?? ""));
  return saveReading({}, data);
}
