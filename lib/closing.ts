import { query, queryOne } from "@/lib/db";
import { isScheduled } from "@/lib/habits";

export type Closing = { date: string; line: string | null; priorities: string[]; focus: string | null };

export async function getClosing(userId: string, date: string): Promise<Closing | null> {
  return queryOne<Closing>("SELECT date::text AS date, line, priorities, focus FROM daily_closings WHERE user_id = $1 AND date = $2::date", [userId, date]);
}

export type DaySummary = { habitsDone: number; habitsTotal: number; activities: { name: string; minutes: number }[]; pages: number; spentCents: number };

/** Resumo automático do dia para o fechamento (hábitos, atividades, páginas lidas e gastos). */
export async function daySummary(userId: string, date: string): Promise<DaySummary> {
  const [habits, done, acts, pages, spent] = await Promise.all([
    query<{ id: string; frequency: "daily" | "weekdays" | "times_per_week"; weekdays: number[]; times_per_week: number | null }>("SELECT id, frequency, weekdays, times_per_week FROM habits WHERE user_id = $1 AND NOT archived", [userId]),
    queryOne<{ n: string }>("SELECT count(*)::text AS n FROM habit_logs WHERE user_id = $1 AND date = $2::date", [userId, date]),
    query<{ name: string; minutes: number }>("SELECT a.name, sum(l.duration_min)::int AS minutes FROM activity_logs l JOIN activities a ON a.id = l.activity_id WHERE l.user_id = $1 AND l.date = $2::date GROUP BY a.name ORDER BY sum(l.duration_min) DESC", [userId, date]),
    queryOne<{ n: string | null }>("SELECT sum(pages)::text AS n FROM reading_logs WHERE user_id = $1 AND date = $2::date", [userId, date]),
    queryOne<{ n: string | null }>("SELECT sum(amount_cents)::text AS n FROM expenses WHERE user_id = $1 AND date = $2::date AND trip_id IS NULL", [userId, date]),
  ]);
  const total = habits.filter((h) => isScheduled({ id: h.id, frequency: h.frequency, weekdays: h.weekdays, timesPerWeek: h.times_per_week }, date)).length;
  return { habitsDone: Number(done?.n ?? 0), habitsTotal: total, activities: acts, pages: Number(pages?.n ?? 0), spentCents: Number(spent?.n ?? 0) };
}

import { addDays } from "@/lib/time";
import { createHash } from "node:crypto";

export type Focus = { text: string; source: "seu" | "trecho"; from: string | null };

/**
 * Foco do dia (11.9): o que você escreveu no fechamento de ontem; se ficou em branco, um trecho salvo sorteado
 * (o mesmo o dia todo). Sem frases de terceiros: só o que é seu.
 */
export async function focusFor(userId: string, today: string): Promise<Focus | null> {
  const y = await getClosing(userId, addDays(today, -1));
  if (y?.focus) return { text: y.focus, source: "seu", from: null };
  const notes = await query<{ id: string; quote: string; title: string }>("SELECT n.id, n.quote, r.title FROM reading_notes n JOIN reading_items r ON r.id = n.item_id WHERE n.user_id = $1 AND n.quote IS NOT NULL AND length(trim(n.quote)) > 0 ORDER BY n.id", [userId]);
  if (notes.length === 0) return null;
  const n = parseInt(createHash("sha256").update(userId + today).digest("hex").slice(0, 8), 16) % notes.length;
  const q = notes[n].quote.trim();
  return { text: q.length > 200 ? q.slice(0, 199).trimEnd() + "…" : q, source: "trecho", from: notes[n].title };
}
