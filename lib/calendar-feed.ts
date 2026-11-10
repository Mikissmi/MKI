import { randomBytes } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { fetchOccurrences } from "@/lib/agenda/queries";
import { addDays, localDateKey, zonedToUtc } from "@/lib/time";
import { getSettings } from "@/lib/settings";
import { buildIcs, type IcsEvent } from "@/lib/ics";

const PAST_DAYS = 7;
const FUTURE_DAYS = 90;

/** Eventos, deslocamentos e blocos do plano aceitos (de 7 dias atrás a 90 dias à frente). Nada além de título e horário. */
export async function calendarEvents(userId: string, today = localDateKey()): Promise<IcsEvent[]> {
  const from = addDays(today, -PAST_DAYS), to = addDays(today, FUTURE_DAYS);
  const [occ, blocks] = await Promise.all([
    fetchOccurrences(userId, from, to),
    query<{ id: string; date: string; start_min: number; duration_min: number; title: string }>("SELECT id, date::text AS date, start_min, duration_min, title FROM plan_blocks WHERE user_id = $1 AND status = 'accepted' AND kind <> 'ajuste' AND date BETWEEN $2::date AND $3::date", [userId, from, to]),
  ]);
  const out: IcsEvent[] = [];
  for (const o of occ) {
    if (o.canceled || (o.kind !== "event" && o.kind !== "travel")) continue;
    out.push({ uid: `${o.kind}-${o.key}@mki`, title: o.kind === "travel" ? `Deslocamento: ${o.title}` : o.title, start: zonedToUtc(o.date, o.startMin), end: zonedToUtc(o.date, Math.max(o.endMin, o.startMin + 5)) });
  }
  for (const b of blocks) out.push({ uid: `block-${b.id}@mki`, title: b.title, start: zonedToUtc(b.date, b.start_min), end: zonedToUtc(b.date, b.start_min + b.duration_min) });
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function renderCalendar(userId: string): Promise<string> {
  const s = await getSettings(userId);
  return buildIcs(await calendarEvents(userId), { name: "MKI", alarmMin: s.calendarAlarmMin });
}

export type CalendarToken = { id: string; code: string; created_at: string };

export async function activeToken(userId: string): Promise<CalendarToken | null> {
  return queryOne<CalendarToken>("SELECT id, code, created_at::text AS created_at FROM calendar_tokens WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1", [userId]);
}

/** Gera um endereço novo; o anterior deixa de valer na hora. */
export async function generateToken(userId: string): Promise<string> {
  await query("UPDATE calendar_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  const code = randomBytes(32).toString("base64url");
  await query("INSERT INTO calendar_tokens (user_id, code) VALUES ($1,$2)", [userId, code]);
  return code;
}

export async function revokeTokens(userId: string): Promise<void> {
  await query("UPDATE calendar_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

export async function userForCode(code: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(code)) return null;
  return (await queryOne<{ user_id: string }>("SELECT user_id FROM calendar_tokens WHERE code = $1 AND revoked_at IS NULL", [code]))?.user_id ?? null;
}
