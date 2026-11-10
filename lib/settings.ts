import { query, queryOne } from "@/lib/db";
import { parseTime } from "@/lib/time";
import { cleanCustom, KITS, DEFAULT_CUSTOM } from "@/lib/shortcuts";

export type AiShare = { agenda: boolean; mood: boolean; diary: boolean; expenses: boolean; health: boolean; music: boolean };
export type SpotifyFeatures = { playlists: boolean; search: boolean; history: boolean };
/** Notificações opcionais (11.5): cada aviso é ligado um a um; tudo começa desligado. */
export type NotifySettings = { enabled: boolean; plan: boolean; closing: boolean; events: boolean; retro: boolean; eventLeadMin: number; planTime: string; closingTime: string; quietStart: string; quietEnd: string };
export type Accent = "lotus" | "sage" | "sun" | "lavender";

export type Settings = {
  displayName: string | null;
  accent: Accent;
  wake: string;
  sleep: string;
  aiEnabled: boolean;
  aiShare: AiShare;
  aiCooldownMin: number;
  waterGoal: number;
  monthlyBudgetCents: number | null;
  readingSessionsPerWeek: number;
  readingBooksPerYear: number;
  screenBreakReminder: boolean;
  retroNotice: boolean;
  spotifyFeatures: SpotifyFeatures;
  /** intervalo mínimo entre atualizações do Spotify ao abrir a tela de Música (minutos) */
  spotifyMinIntervalMin: number;
  /** limite de chamadas ao Spotify por dia dentro do app */
  spotifyDailyLimit: number;
  /** kit de atalhos do ícone: um dos kits prontos ou "custom" */
  shortcutKit: string;
  shortcutCustom: string[];
  /** dias sem abrir o app para mostrar as boas-vindas de volta */
  welcomeAfterDays: number;
  morningSummary: boolean;
  memoryCard: boolean;
  notify: NotifySettings;
  /** última data em que o app foi aberto (para as boas-vindas de volta) */
  lastSeenOn: string | null;
  welcomePending: boolean;
  /** alarme dos eventos no calendário assinável, em minutos antes (0 = sem alarme) */
  calendarAlarmMin: number;
};

export const AI_DAILY_LIMIT = 10; // decisão fechada: 10 chamadas por dia dentro do app

const DEFAULTS: Settings = {
  displayName: null, accent: "lotus", wake: "07:00", sleep: "23:00", aiEnabled: true,
  aiShare: { agenda: true, mood: true, diary: false, expenses: false, health: false, music: false },
  aiCooldownMin: 5, waterGoal: 8, monthlyBudgetCents: null, readingSessionsPerWeek: 5, readingBooksPerYear: 12, screenBreakReminder: false, retroNotice: true,
  spotifyFeatures: { playlists: true, search: true, history: false }, spotifyMinIntervalMin: 60, spotifyDailyLimit: 100,
  shortcutKit: "custom", shortcutCustom: DEFAULT_CUSTOM, welcomeAfterDays: 3, morningSummary: true, memoryCard: true,
  lastSeenOn: null, welcomePending: false, calendarAlarmMin: 15,
  notify: { enabled: false, plan: false, closing: false, events: false, retro: false, eventLeadMin: 15, planTime: "07:30", closingTime: "21:30", quietStart: "22:00", quietEnd: "07:00" },
};

const isTime = (v: unknown): v is string => typeof v === "string" && parseTime(v) !== null;
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const int = (v: unknown, d: number, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : d);

export function normalizeSettings(d: Record<string, unknown>): Settings {
  const share = (d.aiShare ?? {}) as Record<string, unknown>;
  const nt = (d.notify ?? {}) as Record<string, unknown>;
  return {
    displayName: typeof d.displayName === "string" && d.displayName.trim() ? d.displayName.trim().slice(0, 40) : null,
    accent: (["lotus", "sage", "sun", "lavender"] as const).find((a) => a === d.accent) ?? DEFAULTS.accent,
    wake: isTime(d.wake) ? d.wake : DEFAULTS.wake,
    sleep: isTime(d.sleep) ? d.sleep : DEFAULTS.sleep,
    aiEnabled: bool(d.aiEnabled, DEFAULTS.aiEnabled),
    aiShare: {
      agenda: bool(share.agenda, DEFAULTS.aiShare.agenda), mood: bool(share.mood, DEFAULTS.aiShare.mood), diary: bool(share.diary, DEFAULTS.aiShare.diary),
      expenses: bool(share.expenses, DEFAULTS.aiShare.expenses), health: bool(share.health, DEFAULTS.aiShare.health), music: bool(share.music, DEFAULTS.aiShare.music),
    },
    aiCooldownMin: int(d.aiCooldownMin, DEFAULTS.aiCooldownMin, 1, 120),
    waterGoal: int(d.waterGoal, DEFAULTS.waterGoal, 1, 40),
    monthlyBudgetCents: typeof d.monthlyBudgetCents === "number" && d.monthlyBudgetCents > 0 ? Math.round(d.monthlyBudgetCents) : null,
    readingSessionsPerWeek: int(d.readingSessionsPerWeek, DEFAULTS.readingSessionsPerWeek, 1, 21),
    readingBooksPerYear: int(d.readingBooksPerYear, DEFAULTS.readingBooksPerYear, 1, 365),
    screenBreakReminder: bool(d.screenBreakReminder, DEFAULTS.screenBreakReminder),
    retroNotice: bool(d.retroNotice, DEFAULTS.retroNotice),
    spotifyFeatures: {
      playlists: bool(((d.spotifyFeatures ?? {}) as Record<string, unknown>).playlists, DEFAULTS.spotifyFeatures.playlists),
      search: bool(((d.spotifyFeatures ?? {}) as Record<string, unknown>).search, DEFAULTS.spotifyFeatures.search),
      history: bool(((d.spotifyFeatures ?? {}) as Record<string, unknown>).history, DEFAULTS.spotifyFeatures.history),
    },
    spotifyMinIntervalMin: int(d.spotifyMinIntervalMin, DEFAULTS.spotifyMinIntervalMin, 5, 1440),
    spotifyDailyLimit: int(d.spotifyDailyLimit, DEFAULTS.spotifyDailyLimit, 5, 1000),
    shortcutKit: d.shortcutKit === "custom" || KITS.some((k) => k.key === d.shortcutKit) ? (d.shortcutKit as string) : DEFAULTS.shortcutKit,
    shortcutCustom: cleanCustom(d.shortcutCustom),
    welcomeAfterDays: int(d.welcomeAfterDays, DEFAULTS.welcomeAfterDays, 1, 30),
    morningSummary: bool(d.morningSummary, DEFAULTS.morningSummary),
    memoryCard: bool(d.memoryCard, DEFAULTS.memoryCard),
    lastSeenOn: typeof d.lastSeenOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.lastSeenOn) ? d.lastSeenOn : null,
    welcomePending: bool(d.welcomePending, false),
    calendarAlarmMin: int(d.calendarAlarmMin, DEFAULTS.calendarAlarmMin, 0, 1440),
    notify: {
      enabled: bool(nt.enabled, false), plan: bool(nt.plan, false), closing: bool(nt.closing, false), events: bool(nt.events, false), retro: bool(nt.retro, false),
      eventLeadMin: int(nt.eventLeadMin, DEFAULTS.notify.eventLeadMin, 1, 180),
      planTime: isTime(nt.planTime) ? nt.planTime : DEFAULTS.notify.planTime, closingTime: isTime(nt.closingTime) ? nt.closingTime : DEFAULTS.notify.closingTime,
      quietStart: isTime(nt.quietStart) ? nt.quietStart : DEFAULTS.notify.quietStart, quietEnd: isTime(nt.quietEnd) ? nt.quietEnd : DEFAULTS.notify.quietEnd,
    },
  };
}

export async function getSettings(userId: string): Promise<Settings> {
  const row = await queryOne<{ data: Record<string, unknown> }>("SELECT data FROM settings WHERE user_id = $1", [userId]);
  return normalizeSettings(row?.data ?? {});
}

export async function patchSettings(userId: string, patch: Partial<Settings>): Promise<void> {
  await query(
    `INSERT INTO settings (user_id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET data = settings.data || $2::jsonb, updated_at = now()`,
    [userId, JSON.stringify(patch)],
  );
}
