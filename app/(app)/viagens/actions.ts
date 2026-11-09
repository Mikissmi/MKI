"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { id, moneyCents, oneOf, optDate, optMoneyCents, optText, optUuid, reqDate, reqInt, text, url, uuid } from "@/lib/schema-kit";
import type { FormState } from "@/lib/agenda/schemas";

const trip: CrudDef = {
  table: "trips",
  schema: z.object({ id, name: text(100), status: oneOf(["quero_ir", "planejado", "visitado"]), notes: optText(2000), link: url(), estimated_cost_cents: optMoneyCents(), start_on: optDate, end_on: optDate, cover_url: url() })
    .refine((v) => !v.start_on || !v.end_on || v.end_on >= v.start_on, { path: ["end_on"], message: "A volta não pode ser antes da ida" }),
};
const day: CrudDef = { table: "trip_days", schema: z.object({ id, trip_id: uuid, day_number: reqInt(1, 90), title: text(120), notes: optText(1000) }) };
const pack: CrudDef = { table: "packing_items", schema: z.object({ id, trip_id: optUuid, title: text(80) }) };
const entry: CrudDef = { table: "trip_entries", schema: z.object({ id, trip_id: uuid, date: reqDate, text: optText(4000), photo_url: url() }).refine((v) => v.text || v.photo_url, { path: ["text"], message: "Escreva algo ou cole o link de uma foto" }) };
const tripExpense: CrudDef = { table: "expenses", schema: z.object({ id, date: reqDate, amount_cents: moneyCents(), category_id: optUuid, note: optText(160), trip_id: uuid }) };

/** O registro só pode apontar para uma viagem do próprio usuário. */
async function ownTrip(userId: string, f: FormData): Promise<boolean> {
  const t = String(f.get("trip_id") ?? "");
  if (!t) return true;
  return Boolean(await queryOne("SELECT 1 FROM trips WHERE id = $1 AND user_id = $2", [t, userId]));
}
const guard = async (f: FormData, run: (uid: string) => Promise<FormState>): Promise<FormState> => {
  const u = await requireUser();
  if (!(await ownTrip(u.id, f))) return { error: "Viagem inválida." };
  return run(u.id);
};

export async function saveTrip(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(trip, f, u.id); }
export async function deleteTrip(f: FormData) { const u = await requireUser(); await removeRecord("trips", f.get("id"), u.id); }
export async function saveDay(_p: FormState, f: FormData) { return guard(f, (u) => saveRecord(day, f, u)); }
export async function deleteDay(f: FormData) { const u = await requireUser(); await removeRecord("trip_days", f.get("id"), u.id); }
export async function savePackingItem(_p: FormState, f: FormData) { return guard(f, (u) => saveRecord(pack, f, u)); }
export async function deletePackingItem(f: FormData) { const u = await requireUser(); await removeRecord("packing_items", f.get("id"), u.id); }
export async function saveTripEntry(_p: FormState, f: FormData) { return guard(f, (u) => saveRecord(entry, f, u)); }
export async function deleteTripEntry(f: FormData) { const u = await requireUser(); await removeRecord("trip_entries", f.get("id"), u.id); }
export async function saveTripExpense(_p: FormState, f: FormData) {
  return guard(f, async (u) => {
    const cat = String(f.get("category_id") ?? "");
    if (cat && !(await queryOne("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [cat, u]))) return { error: "Categoria inválida." };
    return saveRecord(tripExpense, f, u);
  });
}
export async function deleteTripExpense(f: FormData) { const u = await requireUser(); await removeRecord("expenses", f.get("id"), u.id); }

export async function togglePacking(f: FormData) {
  const u = await requireUser();
  const id = z.string().uuid().safeParse(f.get("id"));
  if (!id.success) return;
  await query("UPDATE packing_items SET checked = NOT checked WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  revalidatePath("/", "layout");
}

/** Copia o modelo de mala (reaproveitável) para a viagem, sem repetir itens. */
export async function copyPackingTemplate(f: FormData) {
  const u = await requireUser();
  const tripId = z.string().uuid().safeParse(f.get("trip_id"));
  if (!tripId.success || !(await queryOne("SELECT 1 FROM trips WHERE id = $1 AND user_id = $2", [tripId.data, u.id]))) return;
  await query(
    `INSERT INTO packing_items (user_id, trip_id, title) SELECT $1, $2, t.title FROM packing_items t
      WHERE t.user_id = $1 AND t.trip_id IS NULL AND NOT EXISTS (SELECT 1 FROM packing_items x WHERE x.trip_id = $2 AND lower(x.title) = lower(t.title))`, [u.id, tripId.data]);
  revalidatePath("/", "layout");
}

export async function addTemplateItem(f: FormData) {
  const u = await requireUser();
  const t = String(f.get("title") ?? "").trim().slice(0, 80);
  if (t) await query("INSERT INTO packing_items (user_id, trip_id, title) VALUES ($1, NULL, $2)", [u.id, t]);
  revalidatePath("/", "layout");
}
