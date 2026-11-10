import { query } from "@/lib/db";
import { getSettings, patchSettings, type Settings } from "@/lib/settings";
import { addDays, daysBetween, eachDay, localDateKey } from "@/lib/time";

/**
 * Boas-vindas de volta (11.7): quantos dias passaram desde a última abertura?
 * Devolve os dias de ausência (sem contar a última abertura nem hoje) quando o intervalo chega ao limite configurado.
 */
export function absenceDays(lastSeenOn: string | null, today: string, afterDays: number): string[] {
  if (!lastSeenOn || lastSeenOn >= today) return [];
  const gap = daysBetween(lastSeenOn, today);
  if (gap < afterDays) return [];
  return eachDay(addDays(lastSeenOn, 1), addDays(today, -1)).slice(-60);
}

/**
 * Registra a abertura de hoje. Se houve uma ausência longa: pausa os hábitos nesses dias (sem quebrar a sequência)
 * e deixa as boas-vindas pendentes até a pessoa responder. Roda no máximo uma vez por dia.
 */
export async function recordOpen(userId: string, settings: Settings, today: string = localDateKey()): Promise<void> {
  if (settings.lastSeenOn === today) return;
  const away = absenceDays(settings.lastSeenOn, today, settings.welcomeAfterDays);
  if (away.length) {
    await query("INSERT INTO paused_days (user_id, date) SELECT $1, d::date FROM unnest($2::text[]) AS d ON CONFLICT DO NOTHING", [userId, away]);
  }
  await patchSettings(userId, { lastSeenOn: today, ...(away.length ? { welcomePending: true } : {}) });
}

/** As boas-vindas aparecem quando há ausência longa ainda não respondida (ou ainda não registrada nesta abertura). */
export const welcomeDue = (s: Settings, today: string): boolean => s.welcomePending || absenceDays(s.lastSeenOn, today, s.welcomeAfterDays).length > 0;

export async function dismissWelcome(userId: string): Promise<void> {
  await patchSettings(userId, { welcomePending: false });
}

export { getSettings };
