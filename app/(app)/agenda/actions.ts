"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { patchSettings } from "@/lib/settings";
import { eventSchema, hoursSchema, routineBlockSchema, zodState, type FormState } from "@/lib/agenda/schemas";
import { parseTime, zonedToUtc } from "@/lib/time";

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
  if (v.id) {
    const rows = await query(
      `UPDATE routine_blocks SET title=$3, weekdays=$4, start_time=$5, end_time=$6, category=$7
        WHERE id=$1 AND user_id=$2 RETURNING id`,
      [v.id, user.id, v.title, v.weekdays, v.start, v.end, v.category],
    );
    if (rows.length === 0) return { error: "Bloco não encontrado." };
  } else {
    await query(
      "INSERT INTO routine_blocks (user_id, title, weekdays, start_time, end_time, category) VALUES ($1,$2,$3,$4,$5,$6)",
      [user.id, v.title, v.weekdays, v.start, v.end, v.category],
    );
  }
  revalidatePath("/", "layout");
  return { ok: true };
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
