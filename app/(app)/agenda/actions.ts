"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { patchSettings } from "@/lib/settings";
import { eventSchema, hoursSchema, overrideSchema, routineBlockSchema, zodState, type FormState } from "@/lib/agenda/schemas";
import { fmtMin, parseTime, zonedToUtc } from "@/lib/time";

const obj = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string"));

export async function saveEvent(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = eventSchema.safeParse(obj(form));
  if (!parsed.success) return zodState(parsed.error);
  const v = parsed.data;

  const start = parseTime(v.time)!;
  const startsAt = zonedToUtc(v.date, start).toISOString();
  const endsAt = zonedToUtc(v.date, start + v.duration).toISOString();
  const until = v.recurrence === "none" ? null : v.until;

  if (v.id) {
    const rows = await query(
      `UPDATE events SET title=$3, starts_at=$4, ends_at=$5, location=$6, category=$7, notes=$8,
              recurrence=$9, recurrence_until=$10, remind_minutes=$11
        WHERE id=$1 AND user_id=$2 RETURNING id`,
      [v.id, user.id, v.title, startsAt, endsAt, v.location, v.category, v.notes, v.recurrence, until, v.remind],
    );
    if (rows.length === 0) return { error: "Evento não encontrado." };
  } else {
    await query(
      `INSERT INTO events (user_id, title, starts_at, ends_at, location, category, notes, recurrence, recurrence_until, remind_minutes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [user.id, v.title, startsAt, endsAt, v.location, v.category, v.notes, v.recurrence, until, v.remind],
    );
  }
  revalidatePath("/", "layout");
  redirect(`/agenda?v=dia&d=${v.date}`);
}

export async function deleteEvent(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await query("DELETE FROM events WHERE id=$1 AND user_id=$2", [id.data, user.id]);
  revalidatePath("/", "layout");
  redirect("/agenda");
}

export async function saveRoutineBlock(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const raw = { ...obj(form), weekdays: form.getAll("weekdays") };
  const parsed = routineBlockSchema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error);
  const v = parsed.data;
  const flexible = v.mode === "flexible";
  // no modo flexível, start_time/end_time guardam o horário preferido e o fim correspondente
  const prefMin = flexible ? parseTime(v.preferred!)! : 0;
  const startTime = flexible ? fmtMin(prefMin) : v.start!;
  const endTime = flexible ? fmtMin(prefMin + v.duration_hours!) : v.end!;
  const cols = [v.title, v.weekdays, startTime, endTime, v.category, v.mode, flexible ? v.earliest : null, flexible ? v.latest : null, flexible ? v.preferred : null, flexible ? v.duration_hours : null, v.travel_to, v.travel_from, v.travel_mode ?? null, v.travel_suggestions];
  if (v.id) {
    const rows = await query(
      `UPDATE routine_blocks SET title=$3, weekdays=$4, start_time=$5, end_time=$6, category=$7, mode=$8, start_earliest=$9, start_latest=$10, preferred_start=$11, duration_min=$12,
              travel_to_min=$13, travel_from_min=$14, travel_mode=$15, travel_suggestions=$16 WHERE id=$1 AND user_id=$2 RETURNING id`, [v.id, user.id, ...cols]);
    if (rows.length === 0) return { error: "Bloco não encontrado." };
    // trocar para fixo deixa as exceções de horário real sem efeito; limpa para não confundir
    if (!flexible) await query("UPDATE routine_overrides SET start_actual = NULL WHERE block_id = $1 AND user_id = $2", [v.id, user.id]);
  } else {
    await query(
      `INSERT INTO routine_blocks (user_id, title, weekdays, start_time, end_time, category, mode, start_earliest, start_latest, preferred_start, duration_min, travel_to_min, travel_from_min, travel_mode, travel_suggestions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`, [user.id, ...cols]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Exceção de um dia: horário real do bloco flexível ("hoje comecei às 09:00"), sem deslocamento ou bloco cancelado.
 * Sem nada marcado, a exceção é removida (volta ao padrão).
 */
export async function saveOverride(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = overrideSchema.safeParse(obj(form));
  if (!parsed.success) return zodState(parsed.error);
  const v = parsed.data;
  const block = await queryOne<{ mode: string; start_earliest: string | null; start_latest: string | null }>(
    "SELECT mode, start_earliest::text AS start_earliest, start_latest::text AS start_latest FROM routine_blocks WHERE id = $1 AND user_id = $2", [v.block_id, user.id]);
  if (!block) return { error: "Bloco não encontrado." };
  let startActual = v.start_actual;
  if (block.mode !== "flexible") startActual = null;
  else if (startActual) {
    const t = parseTime(startActual)!, e = parseTime(block.start_earliest ?? "") ?? 0, l = parseTime(block.start_latest ?? "") ?? 1439;
    if (t < e || t > l) return { error: `O horário precisa estar na janela (${fmtMin(e)} às ${fmtMin(l)}).`, fieldErrors: { start_actual: `Use um horário entre ${fmtMin(e)} e ${fmtMin(l)}` } };
  }
  if (!startActual && !v.skip_travel && !v.canceled) {
    await query("DELETE FROM routine_overrides WHERE block_id = $1 AND user_id = $2 AND date = $3::date", [v.block_id, user.id, v.date]);
  } else {
    await query(
      `INSERT INTO routine_overrides (user_id, block_id, date, start_actual, skip_travel, canceled) VALUES ($1,$2,$3::date,$4,$5,$6)
       ON CONFLICT (block_id, date) DO UPDATE SET start_actual = $4, skip_travel = $5, canceled = $6`, [user.id, v.block_id, v.date, startActual, v.skip_travel, v.canceled]);
  }
  // o plano do dia depende dos horários: marca como desatualizado para ser refeito
  await query("UPDATE day_plans SET input_hash = '' WHERE user_id = $1 AND date = $2::date", [user.id, v.date]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeOverride(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  const row = await queryOne<{ date: string }>("DELETE FROM routine_overrides WHERE id = $1 AND user_id = $2 RETURNING date::text AS date", [id.data, user.id]);
  if (row) await query("UPDATE day_plans SET input_hash = '' WHERE user_id = $1 AND date = $2::date", [user.id, row.date]);
  revalidatePath("/", "layout");
}

export async function deleteRoutineBlock(form: FormData): Promise<void> {
  const user = await requireUser();
  const id = z.string().uuid().safeParse(form.get("id"));
  if (!id.success) return;
  await query("DELETE FROM routine_blocks WHERE id=$1 AND user_id=$2", [id.data, user.id]);
  revalidatePath("/", "layout");
}

export async function saveHours(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = hoursSchema.safeParse(obj(form));
  if (!parsed.success) return zodState(parsed.error);
  await patchSettings(user.id, parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}
