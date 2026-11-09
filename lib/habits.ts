import { addDays, startOfWeek, weekday } from "@/lib/time";

export type HabitDef = { id: string; frequency: "daily" | "weekdays" | "times_per_week"; weekdays: number[]; timesPerWeek: number | null };

/** O hábito está "programado" neste dia? (times_per_week conta como programado todo dia até bater a meta da semana) */
export function isScheduled(h: HabitDef, day: string): boolean {
  if (h.frequency === "daily" || h.frequency === "times_per_week") return true;
  return h.weekdays.includes(weekday(day));
}

/** Registros na semana (domingo a sábado) que contém `day`. */
export function doneInWeek(logs: Set<string>, day: string): number {
  const start = startOfWeek(day);
  let n = 0;
  for (let i = 0; i < 7; i++) if (logs.has(addDays(start, i))) n++;
  return n;
}

/** Falta fazer hoje? Considera feito, dia programado e meta semanal. */
export function isPendingToday(h: HabitDef, logs: Set<string>, today: string): boolean {
  if (logs.has(today)) return false;
  if (!isScheduled(h, today)) return false;
  if (h.frequency === "times_per_week" && h.timesPerWeek !== null && doneInWeek(logs, today) >= h.timesPerWeek) return false;
  return true;
}

/**
 * Sequência (streak). Dias de Dia leve (`pausedDays`) são ignorados: não quebram a sequência nem contam como atraso.
 * - daily/weekdays: dias programados consecutivos com registro (hoje ainda aberto não quebra).
 * - times_per_week: semanas consecutivas que bateram a meta.
 */
export function streak(h: HabitDef, logs: Set<string>, today: string, pausedDays: Set<string> = new Set()): number {
  if (h.frequency === "times_per_week") {
    const goal = h.timesPerWeek ?? 1;
    let weekStart = startOfWeek(today);
    let n = doneInWeek(logs, today) >= goal ? 1 : 0;
    for (let i = 0; i < 260; i++) {
      weekStart = addDays(weekStart, -7);
      if (doneInWeek(logs, weekStart) >= goal) n++;
      else break;
    }
    return n;
  }
  let n = 0;
  let day = logs.has(today) ? today : addDays(today, -1);
  for (let i = 0; i < 1000; i++) {
    if (!isScheduled(h, day) || pausedDays.has(day)) { day = addDays(day, -1); continue; }
    if (logs.has(day)) { n++; day = addDays(day, -1); } else break;
  }
  return n;
}
