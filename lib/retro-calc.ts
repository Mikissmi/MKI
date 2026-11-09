/** Partes puras da retrospectiva (sem banco), para poderem ser testadas. */
export type DayScore = { date: string; habits: number; activities: number; reading: number; mood: number | null };

/** Melhor dia = mais coisas feitas (hábitos + atividades + leitura) com um ponto extra para humor 4 ou 5. Empates ficam com o primeiro dia. */
export function pickBestDay(days: DayScore[]): { date: string; score: number } | null {
  let best: { date: string; score: number } | null = null;
  for (const d of days) {
    const score = d.habits + d.activities + (d.reading > 0 ? 1 : 0) + (d.mood !== null && d.mood >= 4 ? 1 : 0);
    if (score > 0 && (!best || score > best.score)) best = { date: d.date, score };
  }
  return best;
}

export function periodLabel(period: "semana" | "mes", habitRate: number | null, activityCount: number): string | null {
  const unit = period === "semana" ? "Semana" : "Mês";
  if (habitRate === null && activityCount === 0) return null;
  if ((habitRate ?? 0) >= 70) return `${unit} produtiva`.replace("Mês produtiva", "Mês produtivo");
  if ((habitRate ?? 0) >= 40 || activityCount >= 3) return `${unit} equilibrada`.replace("Mês equilibrada", "Mês equilibrado");
  return `${unit} leve`.replace("Mês leve", "Mês leve");
}

export const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

export const pct = (done: number, total: number): number | null => (total > 0 ? Math.round((done / total) * 100) : null);

/** Diferença em relação ao período anterior, pronta para exibir ("+3", "-2", "igual"). */
export function delta(now: number, before: number | null): { text: string; dir: "up" | "down" | "same" | "none" } {
  if (before === null) return { text: "sem período anterior", dir: "none" };
  const d = Math.round((now - before) * 10) / 10;
  if (d === 0) return { text: "igual ao anterior", dir: "same" };
  return { text: `${d > 0 ? "+" : "-"}${Math.abs(d).toString().replace(".", ",")} vs. anterior`, dir: d > 0 ? "up" : "down" };
}
