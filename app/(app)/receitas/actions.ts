"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, oneOf, optInt, optNum, optText, optUuid, reqDate, tags, text, url } from "@/lib/schema-kit";
import { ensureCookingActivity, ingredientLines } from "@/lib/activities";
import { addDays, localDateKey, startOfWeek } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const recipe: CrudDef = {
  table: "recipes",
  schema: z.object({ id, title: text(120), ingredients: optText(4000), steps: optText(8000), minutes: optInt(1, 1440), servings: optInt(1, 100), photo_url: url(), rating: optNum(0, 5), tags, source_url: url() }),
};
const plan: CrudDef = {
  table: "meal_plans", conflict: ["user_id", "date", "meal"],
  schema: z.object({ id, date: reqDate, meal: oneOf(["cafe", "almoco", "jantar", "lanche"]), recipe_id: optUuid, custom: optText(120) }),
};
const done = () => revalidatePath("/", "layout");
const uuidOf = (f: FormData, k = "id") => z.string().uuid().safeParse(f.get(k));

export async function saveRecipe(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(recipe, f, u.id); }
export async function deleteRecipe(f: FormData) { const u = await requireUser(); await removeRecord("recipes", f.get("id"), u.id); }

/** Planejador: sem receita e sem texto = limpa a refeição. */
export async function savePlan(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  if (!f.get("recipe_id") && !String(f.get("custom") ?? "").trim()) {
    const date = z.string().safeParse(f.get("date")), meal = z.string().safeParse(f.get("meal"));
    if (date.success && meal.success) await query("DELETE FROM meal_plans WHERE user_id = $1 AND date = $2::date AND meal = $3", [u.id, date.data, meal.data]);
    done(); return { ok: true };
  }
  if (f.get("recipe_id")) {
    const own = await queryOne("SELECT 1 FROM recipes WHERE id = $1 AND user_id = $2", [String(f.get("recipe_id")), u.id]);
    if (!own) return { error: "Receita inválida." };
  }
  return saveRecord(plan, f, u.id);
}

async function addToShopping(userId: string, lines: string[], recipeId: string | null) {
  const have = new Set((await query<{ title: string }>("SELECT title FROM shopping_items WHERE user_id = $1 AND NOT checked", [userId])).map((r) => r.title.toLowerCase()));
  for (const l of lines) {
    const t = l.slice(0, 120);
    if (have.has(t.toLowerCase())) continue;
    have.add(t.toLowerCase());
    await query("INSERT INTO shopping_items (user_id, title, recipe_id) VALUES ($1,$2,$3)", [userId, t, recipeId]);
  }
}

export async function addShoppingItem(f: FormData) {
  const u = await requireUser();
  const t = String(f.get("title") ?? "").trim().slice(0, 120);
  if (t) await addToShopping(u.id, [t], null);
  done();
}
export async function toggleShopping(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  await query("UPDATE shopping_items SET checked = NOT checked WHERE id = $1 AND user_id = $2", [id.data, u.id]); done();
}
export async function clearChecked() { const u = await requireUser(); await query("DELETE FROM shopping_items WHERE user_id = $1 AND checked", [u.id]); done(); }

/** Ingredientes da receita -> lista de compras (sem repetir o que já está na lista). */
export async function ingredientsToShopping(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  const r = await queryOne<{ ingredients: string | null }>("SELECT ingredients FROM recipes WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  if (r) await addToShopping(u.id, ingredientLines(r.ingredients), id.data);
  done();
}

/** Lista de compras de tudo que está planejado na semana. */
export async function weekToShopping(f: FormData) {
  const u = await requireUser();
  const start = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(f.get("week"));
  if (!start.success) return;
  const rows = await query<{ id: string; ingredients: string | null }>(
    `SELECT DISTINCT r.id, r.ingredients FROM meal_plans m JOIN recipes r ON r.id = m.recipe_id WHERE m.user_id = $1 AND m.date BETWEEN $2::date AND $3::date`, [u.id, start.data, addDays(start.data, 6)]);
  for (const r of rows) await addToShopping(u.id, ingredientLines(r.ingredients), r.id);
  done();
}

/** "Cozinhei hoje": entra no histórico "o que cozinhei" e conta como atividade sem tela. */
export async function cookedToday(f: FormData) {
  const u = await requireUser(); const id = uuidOf(f); if (!id.success) return;
  const r = await queryOne<{ title: string; minutes: number | null }>("SELECT title, minutes FROM recipes WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  if (!r) return;
  const today = localDateKey();
  const already = await queryOne("SELECT 1 FROM cooked_log WHERE user_id = $1 AND recipe_id = $2 AND date = $3::date", [u.id, id.data, today]);
  if (already) return;
  await query("INSERT INTO cooked_log (user_id, recipe_id, date) VALUES ($1,$2,$3::date)", [u.id, id.data, today]);
  const act = await ensureCookingActivity(u.id);
  await query("INSERT INTO activity_logs (user_id, activity_id, date, duration_min, comment) VALUES ($1,$2,$3::date,$4,$5)", [u.id, act, today, r.minutes ?? 30, r.title.slice(0, 200)]);
  done();
}

export async function registerPlannedMeal(f: FormData) {
  const u = await requireUser();
  const meal = z.enum(["cafe", "almoco", "jantar", "lanche"]).safeParse(f.get("meal"));
  const desc = String(f.get("description") ?? "").trim().slice(0, 200);
  if (!meal.success || !desc) return;
  await query("INSERT INTO meal_logs (user_id, date, meal, description) VALUES ($1,$2::date,$3,$4)", [u.id, localDateKey(), meal.data, desc]);
  done();
}
void startOfWeek;
