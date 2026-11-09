export const MIN_FREE_MINUTES = 30; // decisão fechada: tempo livre mínimo para sugerir

export type Interval = { startMin: number; endMin: number };

/**
 * Horários livres dentro da janela [windowStart, windowEnd] (acordar → dormir),
 * descontando os compromissos. Só devolve intervalos com pelo menos `minDuration` minutos.
 */
export function freeSlots(
  busy: Interval[],
  windowStart: number,
  windowEnd: number,
  minDuration = MIN_FREE_MINUTES,
): Interval[] {
  if (windowEnd <= windowStart) return [];
  const sorted = busy
    .filter((b) => b.endMin > windowStart && b.startMin < windowEnd && b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const free: Interval[] = [];
  let cursor = windowStart;
  for (const b of sorted) {
    if (b.startMin - cursor >= minDuration) free.push({ startMin: cursor, endMin: b.startMin });
    cursor = Math.max(cursor, b.endMin);
  }
  if (windowEnd - cursor >= minDuration) free.push({ startMin: cursor, endMin: windowEnd });
  return free;
}
