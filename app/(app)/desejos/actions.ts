"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { bool, id, oneOf, optMoneyCents, optText, optUuid, reqInt, text, url } from "@/lib/schema-kit";
import { localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const wish: CrudDef = {
  table: "wishlist_items",
  schema: z.object({
    id, name: text(120), price_cents: optMoneyCents(), url: url(), photo_url: url(), priority: oneOf(["alta", "media", "baixa"]), category: optText(40),
    status: oneOf(["quero", "esperando", "comprei", "ganhei"]), wait_days: reqInt(0, 365),
  }),
};

export async function saveWish(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(wish, f, u.id); }
export async function deleteWish(f: FormData) { const u = await requireUser(); await removeRecord("wishlist_items", f.get("id"), u.id); }

/**
 * "Comprei": só libera depois do período de espera (evita compra por impulso), a não ser que a pessoa confirme que quer comprar antes.
 * Opcionalmente lança o gasto em Finanças.
 */
export async function markBought(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ id: z.string().uuid(), launch_expense: bool, category_id: optUuid, override: bool }).safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Pedido inválido." };
  const item = await queryOne<{ name: string; price_cents: number | null; days_left: number; status: string }>(
    "SELECT name, price_cents, (release_on - $3::date) AS days_left, status FROM wishlist_items WHERE id = $1 AND user_id = $2", [parsed.data.id, u.id, localDateKey()]);
  if (!item) return { error: "Desejo não encontrado." };
  if (item.days_left > 0 && !parsed.data.override) return { error: `Ainda faltam ${item.days_left} ${item.days_left === 1 ? "dia" : "dias"} do seu período de espera. Marque "Comprar mesmo antes do prazo" se tiver certeza.` };
  if (parsed.data.category_id) {
    const own = await queryOne("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [parsed.data.category_id, u.id]);
    if (!own) return { error: "Categoria inválida." };
  }
  await query("UPDATE wishlist_items SET status = 'comprei' WHERE id = $1 AND user_id = $2", [parsed.data.id, u.id]);
  if (parsed.data.launch_expense && item.price_cents && item.price_cents > 0) {
    await query("INSERT INTO expenses (user_id, date, amount_cents, category_id, note) VALUES ($1,$2::date,$3,$4,$5)", [u.id, localDateKey(), item.price_cents, parsed.data.category_id, `Desejo: ${item.name}`.slice(0, 160)]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markReceived(f: FormData) {
  const u = await requireUser();
  const id = z.string().uuid().safeParse(f.get("id"));
  if (!id.success) return;
  await query("UPDATE wishlist_items SET status = 'ganhei' WHERE id = $1 AND user_id = $2", [id.data, u.id]);
  revalidatePath("/", "layout");
}
