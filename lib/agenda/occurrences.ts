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

export type TravelMode = "onibus" | "metro" | "carro" | "a_pe" | "bicicleta";
export const TRAVEL_MODES: { value: TravelMode; label: string; icon: string }[] = [
  { value: "onibus", label: "Ônibus", icon: "bus" }, { value: "metro", label: "Metrô", icon: "train" }, { value: "carro", label: "Carro", icon: "car" },
  { value: "a_pe", label: "A pé", icon: "walk" }, { value: "bicicleta", label: "Bicicleta", icon: "bike" },
];

export type RoutineBlock = {
  id: string;
  title: string;
  weekdays: number[];
  /** fixo: início e fim; flexível: horário preferido e o fim correspondente */
  startMin: number;
  endMin: number;
  category: string;
  mode: "fixed" | "flexible";
  startEarliest: number | null;
  startLatest: number | null;
  preferredStart: number | null;
  durationMin: number | null;
  travelTo: number;
  travelFrom: number;
  travelMode: TravelMode | null;
  travelSuggestions: boolean;
};

/** Exceção de um dia para um bloco da rotina. */
export type RoutineOverride = { id: string; blockId: string; date: string; startActual: number | null; skipTravel: boolean; canceled: boolean };

export type Occurrence = {
  key: string;
  kind: "event" | "routine" | "travel";
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
  // bloco da rotina / deslocamento
  blockId?: string;
  overrideId?: string | null;
  flexible?: boolean;
  /** horário real do dia confirmado pela pessoa */
  confirmed?: boolean;
  window?: { earliest: number; latest: number };
  preferredStart?: number;
  hasTravel?: boolean;
  skipTravel?: boolean;
  canceled?: boolean;
  travelMode?: TravelMode | null;
  direction?: "ida" | "volta";
  suggestions?: boolean;
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

/**
 * Blocos da rotina nos dias pedidos, já com o deslocamento de ida e de volta.
 * - fixo: horário exato; flexível: horário real do dia (se confirmado) ou o preferido até confirmar;
 * - o deslocamento acompanha o horário real (ida termina no início, volta começa no fim);
 * - exceções do dia: sem deslocamento (home office) ou bloco cancelado (some do plano, sem deslocamento).
 */
export function expandRoutine(blocks: RoutineBlock[], from: string, to: string, overrides: RoutineOverride[] = []): Occurrence[] {
  const out: Occurrence[] = [];
  for (const day of eachDay(from, to)) {
    const wd = weekday(day);
    for (const b of blocks) {
      if (!b.weekdays.includes(wd)) continue;
      const ov = overrides.find((o) => o.blockId === b.id && o.date === day) ?? null;
      const flexible = b.mode === "flexible";
      const duration = flexible ? (b.durationMin ?? b.endMin - b.startMin) : b.endMin - b.startMin;
      const start = flexible ? (ov?.startActual ?? b.preferredStart ?? b.startMin) : b.startMin;
      const end = Math.min(start + duration, 24 * 60);
      const canceled = Boolean(ov?.canceled);
      const hasTravel = b.travelTo > 0 || b.travelFrom > 0;
      out.push({
        key: `r:${b.id}:${day}`, kind: "routine", id: b.id, title: b.title, date: day, startMin: start, endMin: end, category: b.category,
        blockId: b.id, overrideId: ov?.id ?? null, flexible, confirmed: flexible && ov?.startActual != null, canceled, hasTravel, skipTravel: Boolean(ov?.skipTravel),
        window: flexible && b.startEarliest !== null && b.startLatest !== null ? { earliest: b.startEarliest, latest: b.startLatest } : undefined,
        preferredStart: flexible ? (b.preferredStart ?? undefined) : undefined,
      });
      if (canceled || ov?.skipTravel) continue;
      const base = { kind: "travel" as const, id: b.id, date: day, category: "outro", blockId: b.id, travelMode: b.travelMode, suggestions: b.travelSuggestions, overrideId: ov?.id ?? null };
      if (b.travelTo > 0) out.push({ ...base, key: `t:${b.id}:${day}:ida`, title: "Deslocamento (ida)", direction: "ida", startMin: Math.max(0, start - b.travelTo), endMin: start });
      if (b.travelFrom > 0 && end < 24 * 60) out.push({ ...base, key: `t:${b.id}:${day}:volta`, title: "Deslocamento (volta)", direction: "volta", startMin: end, endMin: Math.min(24 * 60, end + b.travelFrom) });
    }
  }
  return out;
}

/** Intervalos ocupados do dia: compromissos, blocos da rotina e deslocamentos (cancelados não ocupam). */
export const busyIntervals = (occs: Occurrence[]): { startMin: number; endMin: number }[] =>
  occs.filter((o) => !o.canceled && o.endMin > o.startMin).map((o) => ({ startMin: o.startMin, endMin: o.endMin }));

type RoutineRow = {
  id: string; title: string; weekdays: number[]; start_time: string; end_time: string; category: string;
  mode?: string; start_earliest?: string | null; start_latest?: string | null; preferred_start?: string | null; duration_min?: number | null;
  travel_to_min?: number; travel_from_min?: number; travel_mode?: string | null; travel_suggestions?: boolean;
};
const t = (v: string | null | undefined) => (v ? parseTime(v) : null);

export function toRoutineBlock(r: RoutineRow): RoutineBlock {
  return {
    id: r.id, title: r.title, weekdays: r.weekdays, startMin: parseTime(r.start_time) ?? 0, endMin: parseTime(r.end_time) ?? 0, category: r.category,
    mode: r.mode === "flexible" ? "flexible" : "fixed", startEarliest: t(r.start_earliest), startLatest: t(r.start_latest), preferredStart: t(r.preferred_start),
    durationMin: r.duration_min ?? null, travelTo: r.travel_to_min ?? 0, travelFrom: r.travel_from_min ?? 0,
    travelMode: (r.travel_mode as TravelMode | null) ?? null, travelSuggestions: Boolean(r.travel_suggestions),
  };
}

export function toRoutineOverride(r: { id: string; block_id: string; date: string; start_actual: string | null; skip_travel: boolean; canceled: boolean }): RoutineOverride {
  return { id: r.id, blockId: r.block_id, date: r.date, startActual: t(r.start_actual), skipTravel: r.skip_travel, canceled: r.canceled };
}

export const sortOccurrences = (list: Occurrence[]) =>
  [...list].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin || a.endMin - b.endMin);

export { addDays };
