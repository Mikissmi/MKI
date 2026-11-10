import { parseTime } from "@/lib/time";

/** Horário silencioso: pode atravessar a meia-noite (ex.: 22:00 a 07:00). Início = fim significa sem horário silencioso. */
export function inQuietHours(nowMin: number, start: string, end: string): boolean {
  const s = parseTime(start), e = parseTime(end);
  if (s === null || e === null || s === e) return false;
  return s < e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e;
}

/** Máximo de avisos por dia (plano, fechamento, retrospectiva), sem contar os lembretes de evento. */
export const MAX_DAILY_NOTICES = 3;
/** Depois do horário marcado, o aviso ainda vale por este tempo (se o agendador falhar, não chega horas depois). */
export const NOTICE_WINDOW_MIN = 180;

export const withinWindow = (nowMin: number, atMin: number, windowMin = NOTICE_WINDOW_MIN) => nowMin >= atMin && nowMin < atMin + windowMin;

/** Lembrete de evento: dentro da janela "X minutos antes" e antes de começar. */
export const eventReminderDue = (nowMin: number, startMin: number, leadMin: number) => nowMin >= startMin - leadMin && nowMin < startMin;
