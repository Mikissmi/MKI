"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { patchSettings } from "@/lib/settings";
import { generateToken, revokeTokens } from "@/lib/calendar-feed";

const done = () => revalidatePath("/configuracoes/calendario");

/** Gera um endereço novo (o anterior deixa de valer). */
export async function generateCalendar() { const u = await requireUser(); await generateToken(u.id); done(); }
export async function revokeCalendar() { const u = await requireUser(); await revokeTokens(u.id); done(); }
export async function saveCalendarAlarm(f: FormData) {
  const u = await requireUser();
  const n = Number(f.get("alarm"));
  if ([0, 5, 10, 15, 30, 60, 120, 1440].includes(n)) await patchSettings(u.id, { calendarAlarmMin: n });
  done();
}
