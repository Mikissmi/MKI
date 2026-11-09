import { query, queryOne } from "@/lib/db";
import { isScheduled, streak, type HabitDef } from "@/lib/habits";
import { addDays, addMonths, eachDay, localDateKey, startOfMonth, startOfWeek, zonedToUtc } from "@/lib/time";
import { avg, delta, pct, periodLabel, pickBestDay } from "@/lib/retro-calc";

export type Period = "semana" | "mes";

export type RetroData = {
  start: string; end: string; partial: boolean; label: string | null;
  mood: { date: string; mood: number | null; energy: number | null }[]; moodAvg: number | null; energyAvg: number | null;
  habits: { done: number; scheduled: number; rate: number | null; bestStreak: { name: string; days: number } | null };
  reading: { pages: number; sessions: number; finished: string[] };
  activities: { total: number; top: { name: string; count: number; minutes: number }[]; mostFrequent: string | null };
  screen: { com: number; sem: number };
  spending: { total: number; byCategory: { name: string; color: string; total: number }[] };
  listened: string[]; watched: string[]; cooked: string[];
  created: { minutes: number; sessions: number; projects: string[] };
  bestDay: { date: string; score: number } | null;
  previous: { habitsRate: number | null; pages: number; activities: number; spending: number; moodAvg: number | null } | null;
};

export const periodStart = (period: Period, anyDate: string) => (period === "semana" ? startOfWeek(anyDate) : startOfMonth(anyDate));
export const periodEnd = (period: Period, start: string) => (period === "semana" ? addDays(start, 6) : addDays(addMonths(start, 1), -1));
export const prevStart = (period: Period, start: string) => (period === "semana" ? addDays(start, -7) : addMonths(start, -1));
export const nextStart = (period: Period, start: string) => (period === "semana" ? addDays(start, 7) : addMonths(start, 1));

type Core = Omit<RetroData, "previous">;

async function core(userId: string, period: Period, start: string, today: string): Promise<Core> {
  const end = periodEnd(period, start);
  const upTo = end < today ? end : today;
  const days = eachDay(start, end);
  const logsFrom = addDays(end, -400);

  const [checkins, habits, hlogs, light, reads, finished, acts, spend, audio, media, cooked, sessions, entries] = await Promise.all([
    query<{ date: string; mood: number; energy: number }>("SELECT date::text AS date, mood, energy FROM checkins WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [userId, start, end]),
    query<{ id: string; name: string; frequency: HabitDef["frequency"]; weekdays: number[]; times_per_week: number | null; created: string }>("SELECT id, name, frequency, weekdays, times_per_week, created_at::date::text AS created FROM habits WHERE user_id = $1 AND NOT archived", [userId]),
    query<{ habit_id: string; date: string }>("SELECT habit_id, date::text AS date FROM habit_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [userId, logsFrom, end]),
    query<{ d: string }>("SELECT date::text AS d FROM checkins WHERE user_id = $1 AND energy <= 2 AND date BETWEEN $2::date AND $3::date UNION SELECT date::text FROM day_plans WHERE user_id = $1 AND light_day AND date BETWEEN $2::date AND $3::date", [userId, logsFrom, end]),
    query<{ date: string; pages: number }>("SELECT date::text AS date, pages FROM reading_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [userId, start, end]),
    query<{ title: string }>("SELECT title FROM reading_items WHERE user_id = $1 AND status = 'lido' AND finished_on BETWEEN $2::date AND $3::date ORDER BY finished_on", [userId, start, end]),
    query<{ date: string; name: string; duration_min: number; screen_type: string }>("SELECT l.date::text AS date, a.name, l.duration_min, a.screen_type FROM activity_logs l JOIN activities a ON a.id = l.activity_id WHERE l.user_id = $1 AND l.date BETWEEN $2::date AND $3::date", [userId, start, end]),
    query<{ name: string | null; color: string | null; total: string }>("SELECT c.name, c.color, sum(e.amount_cents)::text AS total FROM expenses e LEFT JOIN categories c ON c.id = e.category_id WHERE e.user_id = $1 AND e.trip_id IS NULL AND e.date BETWEEN $2::date AND $3::date GROUP BY c.name, c.color ORDER BY sum(e.amount_cents) DESC", [userId, start, end]),
    query<{ title: string }>("SELECT title FROM audio_items WHERE user_id = $1 AND listened_on BETWEEN $2::date AND $3::date ORDER BY listened_on", [userId, start, end]),
    query<{ title: string }>("SELECT title FROM media_items WHERE user_id = $1 AND finished_on BETWEEN $2::date AND $3::date ORDER BY finished_on", [userId, start, end]),
    query<{ title: string }>("SELECT DISTINCT r.title FROM cooked_log c JOIN recipes r ON r.id = c.recipe_id WHERE c.user_id = $1 AND c.date BETWEEN $2::date AND $3::date", [userId, start, end]),
    query<{ minutes: number; project: string | null }>("SELECT s.minutes, p.title AS project FROM creative_sessions s LEFT JOIN creative_projects p ON p.id = s.project_id WHERE s.user_id = $1 AND s.date BETWEEN $2::date AND $3::date", [userId, start, end]),
    query<{ title: string }>("SELECT DISTINCT p.title FROM creative_entries e JOIN creative_projects p ON p.id = e.project_id WHERE e.user_id = $1 AND e.date BETWEEN $2::date AND $3::date", [userId, start, end]),
  ]);

  // ---- hábitos (dias de Dia leve ficam de fora: sem cobrança)
  const paused = new Set(light.map((l) => l.d));
  const logsBy = new Map<string, Set<string>>();
  for (const l of hlogs) logsBy.set(l.habit_id, (logsBy.get(l.habit_id) ?? new Set()).add(l.date));
  const countable = days.filter((d) => d <= upTo && !paused.has(d));
  let scheduled = 0, done = 0;
  const doneByDay = new Map<string, number>();
  for (const h of habits) {
    const def: HabitDef = { id: h.id, frequency: h.frequency, weekdays: h.weekdays, timesPerWeek: h.times_per_week };
    const logs = logsBy.get(h.id) ?? new Set<string>();
    const mine = countable.filter((d) => d >= h.created);
    if (h.frequency === "times_per_week") {
      const quota = Math.max(1, Math.round(((h.times_per_week ?? 1) * mine.length) / 7));
      const hit = days.filter((d) => logs.has(d)).length;
      if (mine.length) { scheduled += quota; done += Math.min(hit, quota); }
    } else {
      for (const d of mine) if (isScheduled(def, d)) { scheduled++; if (logs.has(d)) done++; }
    }
    for (const d of days) if (logs.has(d)) doneByDay.set(d, (doneByDay.get(d) ?? 0) + 1);
  }
  let bestStreak: { name: string; days: number } | null = null;
  for (const h of habits) {
    const s = streak({ id: h.id, frequency: h.frequency, weekdays: h.weekdays, timesPerWeek: h.times_per_week }, logsBy.get(h.id) ?? new Set(), upTo, paused);
    if (s > 0 && (!bestStreak || s > bestStreak.days)) bestStreak = { name: h.name, days: s };
  }

  // ---- atividades e tempo de tela
  const byName = new Map<string, { count: number; minutes: number }>();
  let com = 0, sem = 0;
  for (const a of acts) {
    const cur = byName.get(a.name) ?? { count: 0, minutes: 0 };
    byName.set(a.name, { count: cur.count + 1, minutes: cur.minutes + a.duration_min });
    if (a.screen_type === "com_tela") com += a.duration_min; else sem += a.duration_min;
  }
  const top = [...byName.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count || b.minutes - a.minutes);

  const moodBy = new Map(checkins.map((c) => [c.date, c]));
  const pagesBy = new Map<string, number>();
  for (const r of reads) pagesBy.set(r.date, (pagesBy.get(r.date) ?? 0) + r.pages);
  const actsBy = new Map<string, number>();
  for (const a of acts) actsBy.set(a.date, (actsBy.get(a.date) ?? 0) + 1);

  const total = spend.reduce((a, r) => a + Number(r.total), 0);
  const rate = pct(done, scheduled);
  return {
    start, end, partial: end >= today, label: periodLabel(period, rate, acts.length),
    mood: days.map((d) => ({ date: d, mood: moodBy.get(d)?.mood ?? null, energy: moodBy.get(d)?.energy ?? null })),
    moodAvg: avg(checkins.map((c) => c.mood)), energyAvg: avg(checkins.map((c) => c.energy)),
    habits: { done, scheduled, rate, bestStreak },
    reading: { pages: reads.reduce((a, r) => a + r.pages, 0), sessions: new Set(reads.map((r) => r.date)).size, finished: finished.map((f) => f.title) },
    activities: { total: acts.length, top: top.slice(0, 5), mostFrequent: top[0]?.name ?? null },
    screen: { com, sem },
    spending: { total, byCategory: spend.map((r) => ({ name: r.name ?? "Sem categoria", color: r.color ?? "sky", total: Number(r.total) })) },
    listened: audio.map((a) => a.title), watched: media.map((m) => m.title), cooked: cooked.map((c) => c.title),
    created: { minutes: sessions.reduce((a, s) => a + s.minutes, 0), sessions: sessions.length, projects: [...new Set([...sessions.map((s) => s.project).filter((p): p is string => Boolean(p)), ...entries.map((e) => e.title)])] },
    bestDay: pickBestDay(days.map((d) => ({ date: d, habits: doneByDay.get(d) ?? 0, activities: actsBy.get(d) ?? 0, reading: pagesBy.get(d) ?? 0, mood: moodBy.get(d)?.mood ?? null }))),
  };
}

export async function computeRetro(userId: string, period: Period, start: string, today = localDateKey()): Promise<RetroData> {
  const [cur, prev] = await Promise.all([core(userId, period, start, today), core(userId, period, prevStart(period, start), today)]);
  // só compara se houve registros de verdade no período anterior (hábitos cadastrados e sem nenhum registro não contam)
  const hadData = prev.habits.done > 0 || prev.activities.total > 0 || prev.reading.pages > 0 || prev.spending.total > 0 || prev.mood.some((m) => m.mood !== null);
  return { ...cur, previous: hadData ? { habitsRate: prev.habits.rate, pages: prev.reading.pages, activities: prev.activities.total, spending: prev.spending.total, moodAvg: prev.moodAvg } : null };
}

/** Lê do banco (para não recalcular); períodos em andamento são refeitos se tiverem mais de 10 minutos. */
export async function getRetro(userId: string, period: Period, start: string, today = localDateKey()): Promise<{ data: RetroData; reflection: string | null }> {
  const end = periodEnd(period, start);
  const row = await queryOne<{ data: RetroData; reflection: string | null; generated_at: Date | string }>(
    "SELECT data, reflection, generated_at FROM retrospectives WHERE user_id = $1 AND period = $2 AND start_on = $3::date", [userId, period, start]);
  const gen = row ? new Date(row.generated_at).getTime() : 0;
  const ended = end < today;
  const fresh = row && (ended ? gen >= zonedToUtc(addDays(end, 1), 0).getTime() : Date.now() - gen < 10 * 60_000);
  if (row && fresh) return { data: row.data, reflection: row.reflection };
  const data = await computeRetro(userId, period, start, today);
  await query(
    `INSERT INTO retrospectives (user_id, period, start_on, end_on, data) VALUES ($1,$2,$3::date,$4::date,$5::jsonb)
     ON CONFLICT (user_id, period, start_on) DO UPDATE SET data = $5::jsonb, end_on = $4::date, generated_at = now()`, [userId, period, start, end, JSON.stringify(data)]);
  return { data, reflection: row?.reflection ?? null };
}

/** Retrospectiva pronta (período recém-terminado) que a pessoa ainda não abriu: vira aviso dentro do app. */
export async function pendingRetro(userId: string, today = localDateKey()): Promise<{ period: Period; start: string } | null> {
  for (const period of ["semana", "mes"] as const) {
    const start = prevStart(period, periodStart(period, today));
    const end = periodEnd(period, start);
    if (today > addDays(end, 7)) continue;
    const viewed = await queryOne<{ viewed_at: string | null }>("SELECT viewed_at FROM retrospectives WHERE user_id = $1 AND period = $2 AND start_on = $3::date", [userId, period, start]);
    if (viewed?.viewed_at) continue;
    const any = await queryOne("SELECT 1 FROM (SELECT date FROM checkins WHERE user_id = $1 UNION ALL SELECT date FROM habit_logs WHERE user_id = $1 UNION ALL SELECT date FROM activity_logs WHERE user_id = $1 UNION ALL SELECT date FROM reading_logs WHERE user_id = $1) t WHERE date BETWEEN $2::date AND $3::date LIMIT 1", [userId, start, end]);
    if (any) return { period, start };
  }
  return null;
}

export { delta };
