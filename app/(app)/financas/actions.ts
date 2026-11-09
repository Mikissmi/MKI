"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, moneyCents, optMoneyCents, optText, optUuid, oneOf, reqDate, text } from "@/lib/schema-kit";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/options";
import { patchSettings } from "@/lib/settings";
import { ensureCategories } from "@/lib/finance";
import { localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const expense: CrudDef = { table: "expenses", schema: z.object({ id, date: reqDate, amount_cents: moneyCents(), category_id: optUuid, note: optText(160) }) };
const category: CrudDef = {
  table: "categories",
  schema: z.object({ id, name: text(40), color: oneOf(Object.keys(CATEGORY_COLORS) as [string, ...string[]]), icon: oneOf(CATEGORY_ICONS.map((i) => i.value) as [string, ...string[]]) }),
};

/** O gasto só pode usar uma categoria do próprio usuário. */
async function ownCategory(userId: string, f: FormData): Promise<boolean> {
  const cat = String(f.get("category_id") ?? "");
  if (!cat) return true;
  const rows = await query("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [cat, userId]);
  return rows.length > 0;
}

export async function saveExpense(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  if (!(await ownCategory(u.id, f))) return { error: "Categoria inválida." };
  return saveRecord(expense, f, u.id);
}
export async function deleteExpense(f: FormData) { const u = await requireUser(); await removeRecord("expenses", f.get("id"), u.id); }

export async function saveCategory(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  try { return await saveRecord(category, f, u.id); }
  catch { return { error: "Já existe uma categoria com esse nome.", fieldErrors: { name: "Nome já usado" } }; }
}
export async function deleteCategory(f: FormData) { const u = await requireUser(); await removeRecord("categories", f.get("id"), u.id); }

export async function saveBudget(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ budget: optMoneyCents() }).safeParse({ budget: f.get("budget") ?? "" });
  if (!parsed.success) return { error: "Valor inválido.", fieldErrors: { budget: "Valor inválido" } };
  await patchSettings(u.id, { monthlyBudgetCents: parsed.data.budget && parsed.data.budget > 0 ? parsed.data.budget : null });
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Registro rápido (botão +): valor, categoria e nota; a data é hoje. */
export async function quickExpense(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  await ensureCategories(u.id);
  const data = new FormData();
  data.set("date", localDateKey()); data.set("amount_cents", String(f.get("amount_cents") ?? "")); data.set("category_id", String(f.get("category_id") ?? "")); data.set("note", String(f.get("note") ?? ""));
  if (!(await ownCategory(u.id, data))) return { error: "Categoria inválida." };
  return saveRecord(expense, data, u.id);
}
