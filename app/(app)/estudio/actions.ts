"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optText, optUuid, reqDate, reqInt, text, url, uuid } from "@/lib/schema-kit";
import { CHALLENGES } from "@/lib/options";
import { localDateKey, startOfWeek } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const project: CrudDef = { table: "creative_projects", schema: z.object({ id, title: text(100), kind: oneOf(["desenho", "escrita", "programacao", "artesanato", "fotografia", "outro"]), description: optText(1000), cover_url: url() }) };
const entry: CrudDef = { table: "creative_entries", schema: z.object({ id, project_id: uuid, title: text(120), image_url: url(), note: optText(2000), date: reqDate }) };
const inspiration: CrudDef = { table: "inspirations", schema: z.object({ id, project_id: optUuid, image_url: url(), link: url(), note: optText(300) }).refine((v) => v.image_url || v.link || v.note, { path: ["image_url"], message: "Cole um link de imagem, um link ou escreva uma nota" }) };

async function ownProject(userId: string, raw: unknown): Promise<boolean> {
  const p = String(raw ?? "");
  return !p || Boolean(await queryOne("SELECT 1 FROM creative_projects WHERE id = $1 AND user_id = $2", [p, userId]));
}

export async function saveProject(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(project, f, u.id); }
export async function deleteProject(f: FormData) { const u = await requireUser(); await removeRecord("creative_projects", f.get("id"), u.id); }
export async function saveEntry(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  if (!(await ownProject(u.id, f.get("project_id")))) return { error: "Projeto inválido." };
  return saveRecord(entry, f, u.id);
}
export async function deleteEntry(f: FormData) { const u = await requireUser(); await removeRecord("creative_entries", f.get("id"), u.id); }
export async function saveInspiration(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  if (!(await ownProject(u.id, f.get("project_id")))) return { error: "Projeto inválido." };
  return saveRecord(inspiration, f, u.id);
}
export async function deleteInspiration(f: FormData) { const u = await requireUser(); await removeRecord("inspirations", f.get("id"), u.id); }

/** Sorteia (ou troca) o desafio criativo da semana. */
export async function drawChallenge() {
  const u = await requireUser();
  const week = startOfWeek(localDateKey());
  const cur = await queryOne<{ text: string }>("SELECT text FROM challenges WHERE user_id = $1 AND week_start = $2::date", [u.id, week]);
  const options = CHALLENGES.filter((c) => c !== cur?.text);
  const pick = options[Math.floor(Math.random() * options.length)];
  await query(
    `INSERT INTO challenges (user_id, week_start, text) VALUES ($1,$2::date,$3) ON CONFLICT (user_id, week_start) DO UPDATE SET text = $3, done = false`, [u.id, week, pick]);
  revalidatePath("/", "layout");
}
export async function toggleChallenge() {
  const u = await requireUser();
  await query("UPDATE challenges SET done = NOT done WHERE user_id = $1 AND week_start = $2::date", [u.id, startOfWeek(localDateKey())]);
  revalidatePath("/", "layout");
}

/** Salva uma sessão criativa (o timer fica no navegador; aqui só chegam os minutos). */
export async function saveCreativeSession(input: { projectId: string | null; minutes: number }): Promise<{ ok: boolean; error?: string }> {
  const u = await requireUser();
  const parsed = z.object({ projectId: z.string().uuid().nullable(), minutes: z.number().int().min(1).max(720) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Sessão inválida (de 1 a 720 minutos)." };
  if (!(await ownProject(u.id, parsed.data.projectId))) return { ok: false, error: "Projeto inválido." };
  await query("INSERT INTO creative_sessions (user_id, project_id, date, minutes) VALUES ($1,$2,$3::date,$4)", [u.id, parsed.data.projectId, localDateKey(), parsed.data.minutes]);
  // sessões criativas também contam como atividade sem tela no histórico
  revalidatePath("/", "layout");
  return { ok: true };
}
void reqInt;
