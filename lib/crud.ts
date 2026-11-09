import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { query } from "@/lib/db";
import { zodState, type FormState } from "@/lib/agenda/schemas";

/**
 * CRUD genérico por usuário. As colunas vêm das chaves do schema Zod (estáticas, em snake_case) e todo valor
 * vai por parâmetro ($1, $2...). Nunca confia em campos que não estejam no schema.
 */
export type CrudDef = {
  table: string;
  schema: z.ZodObject<z.ZodRawShape>;
  /** campos que chegam com vários valores (checkboxes) */
  multi?: string[];
  /** colunas de uma restrição UNIQUE para fazer upsert (ex.: ["user_id", "date"]) */
  conflict?: string[];
};

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s: string) => {
  if (!IDENT.test(s)) throw new Error(`identificador inválido: ${s}`);
  return `"${s}"`;
};

export async function saveRecord(def: CrudDef, form: FormData, userId: string, fixed: Record<string, unknown> = {}): Promise<FormState> {
  const raw: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") raw[k] = v;
  for (const k of def.multi ?? []) raw[k] = form.getAll(k);
  const parsed = def.schema.safeParse(raw);
  if (!parsed.success) return zodState(parsed.error);

  const { id, ...rest } = parsed.data as Record<string, unknown> & { id?: string };
  const data: Record<string, unknown> = { ...rest, ...fixed };
  const cols = Object.keys(data);

  if (id) {
    const sets = cols.map((c, i) => `${ident(c)} = $${i + 3}`).join(", ");
    const rows = await query(`UPDATE ${ident(def.table)} SET ${sets} WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId, ...cols.map((c) => data[c])]);
    if (rows.length === 0) return { error: "Registro não encontrado." };
  } else {
    const names = ["user_id", ...cols].map(ident).join(", ");
    const marks = ["user_id", ...cols].map((_, i) => `$${i + 1}`).join(", ");
    const conflict = def.conflict
      ? ` ON CONFLICT (${def.conflict.map(ident).join(", ")}) DO UPDATE SET ${cols.filter((c) => !def.conflict!.includes(c)).map((c) => `${ident(c)} = EXCLUDED.${ident(c)}`).join(", ") || `${ident(def.conflict[0])} = EXCLUDED.${ident(def.conflict[0])}`}`
      : "";
    await query(`INSERT INTO ${ident(def.table)} (${names}) VALUES (${marks})${conflict}`, [userId, ...cols.map((c) => data[c])]);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeRecord(table: string, rawId: unknown, userId: string): Promise<void> {
  if (typeof rawId !== "string" || !/^[0-9a-f-]{36}$/i.test(rawId)) return;
  await query(`DELETE FROM ${ident(table)} WHERE id = $1 AND user_id = $2`, [rawId, userId]);
  revalidatePath("/", "layout");
}
