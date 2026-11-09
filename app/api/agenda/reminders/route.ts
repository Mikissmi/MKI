import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { fetchEvents } from "@/lib/agenda/queries";
import { expandEvents } from "@/lib/agenda/occurrences";
import { addDays, localDateKey, zonedToUtc } from "@/lib/time";

/** Lembretes de hoje e amanhã (avisos dentro do app, sem push). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const today = localDateKey();
  const to = addDays(today, 1);
  const events = await fetchEvents(user.id, today, to);
  const reminders = expandEvents(events, today, to)
    .filter((o) => o.remindMinutes !== null && o.remindMinutes !== undefined)
    .map((o) => {
      const startsAt = zonedToUtc(o.date, o.startMin).getTime();
      return { key: o.key, title: o.title, startsAt, remindAt: startsAt - (o.remindMinutes as number) * 60_000, location: o.location ?? null };
    });
  return NextResponse.json({ reminders }, { headers: { "Cache-Control": "no-store" } });
}
