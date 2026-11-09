"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { bool, id, oneOf, optInt, optText, reqDate, reqInt, tags, text, url, uuid } from "@/lib/schema-kit";
import { ACTIVITY_ICONS } from "@/lib/options";
import { localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const activity: CrudDef = {
  table: "activities",
  schema: z.object({
    id, name: text(80), icon: oneOf(ACTIVITY_ICONS.map((i) => i.value) as [string, ...string[]]), minutes: reqInt(5, 600), energy: oneOf(["baixa", "media", "alta"]),
    place: optText(80), tags, screen_type: oneOf(["com_tela", "sem_tela"]),
  }),
};
const activityLog: CrudDef = { table: "activity_logs", schema: z.object({ id, activity_id: uuid, date: reqDate, duration_min: reqInt(1, 1440), comment: optText(300) }) };
const media: CrudDef = {
  table: "media_items",
  schema: z.object({ id, kind: oneOf(["filme", "serie", "jogo", "anime"]), title: text(160), status: oneOf(["quero", "em_andamento", "concluido"]), rating: optInt(1, 5), platform: optText(60), progress: optText(60), cover_url: url() }),
};
const project: CrudDef = { table: "projects", schema: z.object({ id, name: text(100), description: optText(500), notes: optText(4000), progress: optInt(0, 100).transform((v) => v ?? 0), cover_url: url() }) };
const step: CrudDef = { table: "project_steps", schema: z.object({ id, project_id: uuid, title: text(160) }) };
void bool;

export async function saveActivity(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(activity, f, u.id); }
export async function deleteActivity(f: FormData) { const u = await requireUser(); await removeRecord("activities", f.get("id"), u.id); }
export async function saveActivityLog(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(activityLog, f, u.id); }
export async function deleteActivityLog(f: FormData) { const u = await requireUser(); await removeRecord("activity_logs", f.get("id"), u.id); }
export async function saveMedia(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const r = await saveRecord(media, f, u.id);
  if (r.ok) await query("UPDATE media_items SET finished_on = COALESCE(finished_on, $2::date) WHERE user_id = $1 AND status = 'concluido' AND finished_on IS NULL", [u.id, localDateKey()]);
  return r;
}
export async function deleteMedia(f: FormData) { const u = await requireUser(); await removeRecord("media_items", f.get("id"), u.id); }
export async function saveProject(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(project, f, u.id); }
export async function deleteProject(f: FormData) { const u = await requireUser(); await removeRecord("projects", f.get("id"), u.id); }
export async function saveStep(_p: FormState, f: FormData) {
  const u = await requireUser();
  const r = await saveRecord(step, f, u.id);
  return r;
}
export async function deleteStep(f: FormData) { const u = await requireUser(); await removeRecord("project_steps", f.get("id"), u.id); }

/** "Fiz hoje": registra a atividade com a duração padrão. */
export async function quickLogActivity(f: FormData) {
  const u = await requireUser();
  const data = new FormData();
  data.set("activity_id", String(f.get("activity_id") ?? "")); data.set("date", localDateKey()); data.set("duration_min", String(f.get("duration_min") ?? "30"));
  await saveRecord(activityLog, data, u.id);
}

export async function toggleStep(f: FormData) {
  const u = await requireUser();
  const stepId = z.string().uuid().safeParse(f.get("id"));
  if (!stepId.success) return;
  await query("UPDATE project_steps SET done = NOT done WHERE id = $1 AND user_id = $2", [stepId.data, u.id]);
  revalidatePath("/", "layout");
}
