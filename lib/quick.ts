import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { fetchLinkMeta } from "@/lib/safe-fetch";
import { ensureCategories } from "@/lib/finance";
import { addDays, isDateKey, localDateKey } from "@/lib/time";
import { parseDecimal } from "@/lib/schema-kit";

const date = z.string().refine(isDateKey).optional();
const base = { clientId: z.string().uuid(), date };

export const quickSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("expense"), amount: z.string().max(20), category_id: z.string().uuid().nullable().optional(), note: z.string().trim().max(160).optional() }),
  z.object({ ...base, type: z.literal("water"), delta: z.union([z.literal(1), z.literal(-1)]) }),
  z.object({ ...base, type: z.literal("mood"), mood: z.number().int().min(1).max(5), energy: z.number().int().min(1).max(5) }),
  z.object({ ...base, type: z.literal("habit"), habit_id: z.string().uuid() }),
  z.object({ ...base, type: z.literal("idea"), text: z.string().trim().min(1).max(500) }),
  z.object({ ...base, type: z.literal("link"), url: z.string().trim().max(1000).regex(/^https?:\/\/\S+$/i, "Use um link que comece com http ou https") }),
]);
export type QuickOp = z.infer<typeof quickSchema>;

/** Registros feitos offline podem chegar dias depois; aceita a data original só dentro de 14 dias (e nunca no futuro). */
const pickDate = (d: string | undefined, today: string) => (d && d <= today && d >= addDays(today, -14) ? d : today);

export async function applyQuick(userId: string, op: QuickOp): Promise<{ ok: boolean; error?: string; duplicate?: boolean }> {
  const fresh = await queryOne("INSERT INTO quick_ops (client_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING client_id", [op.clientId, userId]);
  if (!fresh) return { ok: true, duplicate: true };
  const today = localDateKey();
  const day = pickDate("date" in op ? op.date : undefined, today);
  try {
    switch (op.type) {
      case "expense": {
        const n = parseDecimal(op.amount);
        if (n === null || Number.isNaN(n) || n <= 0 || n > 1_000_000) throw new Error("Informe um valor maior que zero");
        let cat = op.category_id ?? null;
        if (cat && !(await queryOne("SELECT 1 FROM categories WHERE id = $1 AND user_id = $2", [cat, userId]))) cat = null;
        await ensureCategories(userId);
        await query("INSERT INTO expenses (user_id, date, amount_cents, category_id, note) VALUES ($1,$2::date,$3,$4,$5)", [userId, day, Math.round(n * 100), cat, op.note || null]);
        break;
      }
      case "water":
        await query(`INSERT INTO water_logs (user_id, date, glasses) VALUES ($1,$2::date,GREATEST(0,$3::int))
                     ON CONFLICT (user_id, date) DO UPDATE SET glasses = LEAST(40, GREATEST(0, water_logs.glasses + $3::int))`, [userId, day, op.delta]);
        break;
      case "mood":
        await query(`INSERT INTO checkins (user_id, date, mood, energy) VALUES ($1,$2::date,$3,$4)
                     ON CONFLICT (user_id, date) DO UPDATE SET mood = $3, energy = $4, updated_at = now()`, [userId, day, op.mood, op.energy]);
        break;
      case "habit":
        await query("INSERT INTO habit_logs (user_id, habit_id, date) SELECT $1, id, $3::date FROM habits WHERE id = $2 AND user_id = $1 ON CONFLICT DO NOTHING", [userId, op.habit_id, day]);
        break;
      case "idea":
        await query("INSERT INTO ideas (user_id, text) VALUES ($1,$2)", [userId, op.text]);
        break;
      case "link": {
        const exists = await queryOne("SELECT 1 FROM reading_items WHERE user_id = $1 AND kind = 'artigo' AND url = $2", [userId, op.url]);
        if (!exists) {
          const meta = await fetchLinkMeta(op.url);
          let title = meta.title;
          if (!title) { try { title = new URL(op.url).hostname; } catch { title = "Artigo"; } }
          await query("INSERT INTO reading_items (user_id, kind, title, url, cover_url, status) VALUES ($1,'artigo',$2,$3,$4,'quero')", [userId, title.slice(0, 200), op.url, meta.image]);
        }
        break;
      }
    }
    return { ok: true };
  } catch (e) {
    await query("DELETE FROM quick_ops WHERE client_id = $1", [op.clientId]); // falhou: deixa tentar de novo
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível registrar" };
  }
}
