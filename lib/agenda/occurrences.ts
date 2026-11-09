import { addDays, dayOfMonth, eachDay, localDateKey, localMinutes, weekday, parseTime } from "@/lib/time";

export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type EventRow = {
  id: string;
  title: string;
  /** Data local do primeiro dia e minutos desde 00:00 */
  date: string;
  startMin: number;
  durationMin: number;
  location: string | null;
  category: string;
  notes: string | null;
  recurrence: Recurrence;
  recurrenceUntil: string | null;
  remindMinutes: number | null;
};

export type RoutineBlock = {
  id: string;
  title: string;
  weekdays: number[];
  startMin: number;
  endMin: number;
  category: string;
};

export type Occurrence = {
  key: string;
  kind: "event" | "routine";
  id: string;
  title: string;
  date: string;
  startMin: number;
  endMin: number;
  category: string;
  location?: string | null;
  notes?: string | null;
  recurrence?: Recurrence;
  remindMinutes?: number | null;
};

/** Converte uma linha crua do banco (timestamps) em EventRow no fuso local. */
export function toEventRow(r: {
  id: string; title: string; starts_at: Date | string; ends_at: Date | string; location: string | null;
  category: string; notes: string | null; recurrence: string; recurrence_until: string | null; remind_minutes: number | null;
}): EventRow {
  const s = new Date(r.starts_at), e = new Date(r.ends_at);
  return {
    id: r.id, title: r.title, date: localDateKey(s), startMin: localMinutes(s),
    durationMin: Math.max(1, Math.round((e.getTime() - s.getTime()) / 60_000)),
    location: r.location, category: r.category, notes: r.notes,
    recurrence: r.recurrence as Recurrence, recurrenceUntil: r.recurrence_until, remindMinutes: r.remind_minutes,
  };
}

function matches(ev: EventRow, day: string): boolean {
  if (day < ev.date) return false;
  if (ev.recurrenceUntil && day > ev.recurrenceUntil) return false;
  switch (ev.recurrence) {
    case "none": return day === ev.date;
    case "daily": return true;
    case "weekly": return weekday(day) === weekday(ev.date);
    case "monthly": return dayOfMonth(day) === dayOfMonth(ev.date);
  }
}

export function expandEvents(events: EventRow[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const day of eachDay(from, to)) {
    for (const ev of events) {
      if (!matches(ev, day)) continue;
      out.push({
        key: `${ev.id}:${day}`, kind: "event", id: ev.id, title: ev.title, date: day,
        startMin: ev.startMin, endMin: Math.min(ev.startMin + ev.durationMin, 24 * 60),
        category: ev.category, location: ev.location, notes: ev.notes, recurrence: ev.recurrence, remindMinutes: ev.remindMinutes,
      });
    }
  }
  return out;
}

export function expandRoutine(blocks: RoutineBlock[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const day of eachDay(from, to)) {
    const wd = weekday(day);
    for (const b of blocks) {
      if (!b.weekdays.includes(wd)) continue;
      out.push({
        key: `r:${b.id}:${day}`, kind: "routine", id: b.id, title: b.title, date: day,
        startMin: b.startMin, endMin: b.endMin, category: b.category,
      });
    }
  }
  return out;
}

export function toRoutineBlock(r: { id: string; title: string; weekdays: number[]; start_time: string; end_time: string; category: string }): RoutineBlock {
  return {
    id: r.id, title: r.title, weekdays: r.weekdays,
    startMin: parseTime(r.start_time) ?? 0, endMin: parseTime(r.end_time) ?? 0, category: r.category,
  };
}

export const sortOccurrences = (list: Occurrence[]) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.endMin - b.endMin);

export { addDays };
