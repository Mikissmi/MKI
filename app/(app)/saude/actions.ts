"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optInt, optNum, optOneOf, reqDate, reqInt, text, time } from "@/lib/schema-kit";
import { getSettings } from "@/lib/settings";
import { localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";


const sleep: CrudDef = { table: "sleep_logs", conflict: ["user_id", "date"], schema: z.object({ id, date: reqDate, slept_at: time, woke_at: time, quality: optInt(1, 5) }) };
const meal: CrudDef = { table: "meal_logs", schema: z.object({ id, date: reqDate, meal: oneOf(["cafe", "almoco", "jantar", "lanche"]), description: text(200) }) };
const workout: CrudDef = { table: "workout_logs", schema: z.object({ id, date: reqDate, kind: text(40), duration_min: reqInt(1, 600) }) };
const measure: CrudDef = { table: "body_measures", conflict: ["user_id", "date"], schema: z.object({ id, date: reqDate, weight_kg: optNum(20, 400), waist_cm: optNum(30, 300), hip_cm: optNum(30, 300), steps: optInt(0, 200000) }) };

export async function saveSleep(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(sleep, f, u.id); }
export async function saveMeal(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(meal, f, u.id); }
export async function deleteMeal(f: FormData) { const u = await requireUser(); await removeRecord("meal_logs", f.get("id"), u.id); }
export async function saveWorkout(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(workout, f, u.id); }
export async function deleteWorkout(f: FormData) { const u = await requireUser(); await removeRecord("workout_logs", f.get("id"), u.id); }
export async function saveMeasure(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(measure, f, u.id); }
void optOneOf;

/** Soma ou tira um copo de água de hoje. */
export async function addWater(f: FormData) {
  const user = await requireUser();
  const delta = Number(f.get("delta")) === -1 ? -1 : 1;
  const { waterGoal } = await getSettings(user.id);
  await query(
    `INSERT INTO water_logs (user_id, date, glasses) VALUES ($1, $2::date, GREATEST(0, $3::int))
     ON CONFLICT (user_id, date) DO UPDATE SET glasses = LEAST(40, GREATEST(0, water_logs.glasses + $3::int))`,
    [user.id, localDateKey(), delta],
  );
  void waterGoal;
  revalidatePath("/", "layout");
}
