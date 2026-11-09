"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optInt, optOneOf, reqInt, text, weekdays } from "@/lib/schema-kit";
import { HABIT_ICONS } from "@/lib/options";
import { isDateKey, localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";


const habit: CrudDef = {
  table: "habits", multi: ["weekdays"],
  schema: z.object({
    id, name: text(80), icon: oneOf(HABIT_ICONS), frequency: oneOf(["daily", "weekdays", "times_per_week"]),
    weekdays, times_per_week: optInt(1, 7), routine: optOneOf(["manha", "noite"]),
  }).superRefine((v, ctx) => {
    if (v.frequency === "weekdays" && v.weekdays.length === 0) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Escolha ao menos um dia" });
    if (v.frequency === "times_per_week" && v.times_per_week === null) ctx.addIssue({ code: "custom", path: ["times_per_week"], message: "Quantas vezes por semana?" });
  }),
};
const quickWin: CrudDef = {
  table: "quick_wins",
  schema: z.object({ id, title: text(100), duration_min: reqInt(1, 30), energy: oneOf(["baixa", "media", "alta"]), screen_type: oneOf(["com_tela", "sem_tela"]) }),
};

export async function saveHabit(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(habit, f, u.id); }
export async function deleteHabit(f: FormData) { const u = await requireUser(); await removeRecord("habits", f.get("id"), u.id); }
export async function saveQuickWin(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(quickWin, f, u.id); }
export async function deleteQuickWin(f: FormData) { const u = await requireUser(); await removeRecord("quick_wins", f.get("id"), u.id); }

/** Marca/desmarca o hábito em um dia (padrão: hoje; nunca no futuro). */
export async function toggleHabit(f: FormData) {
  const user = await requireUser();
  const habitId = z.string().uuid().safeParse(f.get("habit_id"));
  const rawDate = f.get("date");
  const date = typeof rawDate === "string" && isDateKey(rawDate) ? rawDate : localDateKey();
  if (!habitId.success || date > localDateKey()) return;
  const removed = await query("DELETE FROM habit_logs WHERE habit_id = $1 AND user_id = $2 AND date = $3::date RETURNING id", [habitId.data, user.id, date]);
  if (removed.length === 0) {
    await query("INSERT INTO habit_logs (user_id, habit_id, date) SELECT $2, id, $3::date FROM habits WHERE id = $1 AND user_id = $2 ON CONFLICT DO NOTHING", [habitId.data, user.id, date]);
  }
  revalidatePath("/", "layout");
}
