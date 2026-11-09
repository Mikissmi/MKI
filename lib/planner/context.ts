import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { fetchCheckin, fetchOccurrences } from "@/lib/agenda/queries";
import { busyIntervals } from "@/lib/agenda/occurrences";
import { isPendingToday, type HabitDef } from "@/lib/habits";
import { addDays, localMinutes, parseTime, startOfWeek } from "@/lib/time";
import { isLowEnergy } from "./rules";
import type { PlanContext } from "./types";

export type LoadedContext = { ctx: PlanContext; settings: Settings; hash: string; lightManual: boolean };

type HabitRow = { id: string; name: string; frequency: HabitDef["frequency"]; weekdays: number[]; times_per_week: number | null; routine: string | null };

export async function loadPlanContext(userId: string, date: string, opts: { today: string; exclude?: string[]; forceLight?: boolean }): Promise<LoadedContext> {
  const isToday = date === opts.today;
  const weekStart = startOfWeek(date);
  const [settings, occurrences, checkin, dayPlan, accepted, habits, habitLogs, books, articles, activities, quickWins, screen, podcasts] = await Promise.all([
    getSettings(userId),
    fetchOccurrences(userId, date, date),
    fetchCheckin(userId, date),
    queryOne<{ light_day: boolean }>("SELECT light_day FROM day_plans WHERE user_id = $1 AND date = $2::date", [userId, date]),
    query<{ start_min: number; duration_min: number }>("SELECT start_min, duration_min FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND status = 'accepted'", [userId, date]),
    query<HabitRow>("SELECT id, name, frequency, weekdays, times_per_week, routine FROM habits WHERE user_id = $1 AND NOT archived", [userId]),
    query<{ habit_id: string; date: string }>("SELECT habit_id, date::text AS date FROM habit_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [userId, weekStart, addDays(weekStart, 6)]),
    query<{ id: string; title: string; kind: string }>(
      "SELECT id, title, kind FROM reading_items WHERE user_id = $1 AND kind = 'livro' AND status IN ('lendo','quero') ORDER BY (status = 'lendo') DESC, created_at LIMIT 5", [userId]),
    query<{ id: string; title: string }>("SELECT id, title FROM reading_items WHERE user_id = $1 AND kind = 'artigo' AND status = 'quero' ORDER BY created_at LIMIT 5", [userId]),
    query<{ id: string; name: string; minutes: number; energy: "baixa" | "media" | "alta"; screen_type: "com_tela" | "sem_tela"; days_since: number | null }>(
      `SELECT a.id, a.name, a.minutes, a.energy, a.screen_type, ($2::date - max(l.date))::int AS days_since
         FROM activities a LEFT JOIN activity_logs l ON l.activity_id = a.id AND l.date <= $2::date
        WHERE a.user_id = $1 GROUP BY a.id`, [userId, date]),
    query<{ id: string; title: string; duration_min: number; energy: "baixa" | "media" | "alta"; screen_type: "com_tela" | "sem_tela" }>(
      "SELECT id, title, duration_min, energy, screen_type FROM quick_wins WHERE user_id = $1 ORDER BY created_at", [userId]),
    query<{ screen_type: "com_tela" | "sem_tela"; minutes: number }>(
      `SELECT a.screen_type, sum(l.duration_min)::int AS minutes FROM activity_logs l JOIN activities a ON a.id = l.activity_id
        WHERE l.user_id = $1 AND l.date = $2::date GROUP BY a.screen_type`, [userId, date]),
    query<{ id: string; title: string }>("SELECT id, title FROM audio_items WHERE user_id = $1 AND kind = 'podcast' AND status = 'quero' ORDER BY created_at LIMIT 5", [userId]),
  ]);

  const logsBy = new Map<string, Set<string>>();
  for (const l of habitLogs) logsBy.set(l.habit_id, (logsBy.get(l.habit_id) ?? new Set()).add(l.date));
  const pendingHabits = habits
    .filter((h) => isPendingToday({ id: h.id, frequency: h.frequency, weekdays: h.weekdays, timesPerWeek: h.times_per_week }, logsBy.get(h.id) ?? new Set(), date))
    .map((h) => ({ id: h.id, name: h.name, routine: h.routine }));

  const lightManual = Boolean(dayPlan?.light_day) || Boolean(opts.forceLight);
  const energy = checkin?.energy ?? null;
  const busy = [
    // compromissos, blocos da rotina (no horário real ou preferido) e deslocamentos; blocos cancelados não ocupam
    ...busyIntervals(occurrences),
    ...accepted.map((b) => ({ startMin: b.start_min, endMin: b.start_min + b.duration_min })),
  ];
  const ctx: PlanContext = {
    date,
    nowMin: isToday ? localMinutes() : null,
    wake: parseTime(settings.wake) ?? 420,
    sleep: parseTime(settings.sleep) ?? 1380,
    busy,
    mood: checkin?.mood ?? null,
    energy,
    lightDay: lightManual || isLowEnergy(energy),
    pendingHabits,
    readingQueue: books,
    shortArticles: articles,
    activities: activities.map((a) => ({ id: a.id, name: a.name, minutes: a.minutes, energy: a.energy, screen: a.screen_type, daysSince: a.days_since })),
    quickWins: quickWins.map((q) => ({ id: q.id, title: q.title, minutes: q.duration_min, energy: q.energy, screen: q.screen_type })),
    screenMinutes: { com: screen.find((s) => s.screen_type === "com_tela")?.minutes ?? 0, sem: screen.find((s) => s.screen_type === "sem_tela")?.minutes ?? 0 },
    exclude: opts.exclude,
    flexBlocks: occurrences.filter((o) => o.kind === "routine" && o.flexible && !o.canceled && o.window).map((o) => ({ blockId: o.blockId!, title: o.title, startMin: o.startMin, durationMin: o.endMin - o.startMin, earliest: o.window!.earliest, latest: o.window!.latest, confirmed: Boolean(o.confirmed) })),
    travelSlots: occurrences.filter((o) => o.kind === "travel" && o.suggestions && !o.canceled).map((o) => ({ startMin: o.startMin, endMin: o.endMin })),
    podcasts,
  };

  // O hash ignora a hora atual: o plano só é refeito quando agenda, energia, hábitos ou preferências mudam.
  const hash = createHash("sha256").update(JSON.stringify({
    d: date, w: ctx.wake, s: ctx.sleep, b: busy, e: ctx.energy, m: settings.aiShare.mood ? ctx.mood : null, l: ctx.lightDay,
    h: pendingHabits.map((h) => h.id), r: books.map((b) => b.id), a: articles.map((a) => a.id),
    ac: ctx.activities.map((a) => [a.id, a.daysSince]), q: ctx.quickWins.map((q) => q.id), sc: [ctx.screenMinutes.com >= 120],
  })).digest("hex").slice(0, 32);

  return { ctx, settings, hash, lightManual };
}
