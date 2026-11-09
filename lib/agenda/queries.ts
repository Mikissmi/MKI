import { query } from "@/lib/db";
import { addDays, zonedToUtc } from "@/lib/time";
import { expandEvents, expandRoutine, sortOccurrences, toEventRow, toRoutineBlock, type EventRow, type Occurrence, type RoutineBlock } from "./occurrences";

const EVENT_COLS = "id, title, starts_at, ends_at, location, category, notes, recurrence, recurrence_until::text AS recurrence_until, remind_minutes";
const ROUTINE_COLS = "id, title, weekdays, start_time::text AS start_time, end_time::text AS end_time, category";

export async function fetchEvents(userId: string, from: string, to: string): Promise<EventRow[]> {
  const rows = await query<Parameters<typeof toEventRow>[0]>(
    `SELECT ${EVENT_COLS} FROM events
      WHERE user_id = $1 AND (
            (recurrence = 'none' AND starts_at >= $2 AND starts_at < $3)
         OR (recurrence <> 'none' AND starts_at < $3 AND (recurrence_until IS NULL OR recurrence_until >= $4::date)))`,
    [userId, zonedToUtc(from, 0).toISOString(), zonedToUtc(addDays(to, 1), 0).toISOString(), from],
  );
  return rows.map(toEventRow);
}

export async function fetchEvent(userId: string, id: string): Promise<EventRow | null> {
  const rows = await query<Parameters<typeof toEventRow>[0]>(`SELECT ${EVENT_COLS} FROM events WHERE user_id = $1 AND id = $2`, [userId, id]);
  return rows[0] ? toEventRow(rows[0]) : null;
}

export async function fetchRoutine(userId: string): Promise<RoutineBlock[]> {
  const rows = await query<Parameters<typeof toRoutineBlock>[0]>(
    `SELECT ${ROUTINE_COLS} FROM routine_blocks WHERE user_id = $1 ORDER BY start_time, title`, [userId]);
  return rows.map(toRoutineBlock);
}

/** Compromissos + rotina-modelo de um intervalo de dias, ordenados. */
export async function fetchOccurrences(userId: string, from: string, to: string): Promise<Occurrence[]> {
  const [events, routine] = await Promise.all([fetchEvents(userId, from, to), fetchRoutine(userId)]);
  return sortOccurrences([...expandEvents(events, from, to), ...expandRoutine(routine, from, to)]);
}

export type Checkin = { date: string; mood: number; energy: number; note: string | null };

export async function fetchCheckin(userId: string, date: string): Promise<Checkin | null> {
  const rows = await query<Checkin>(
    "SELECT date::text AS date, mood, energy, note FROM checkins WHERE user_id = $1 AND date = $2::date", [userId, date]);
  return rows[0] ?? null;
}
