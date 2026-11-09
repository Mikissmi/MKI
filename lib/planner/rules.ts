import { freeSlots, MIN_FREE_MINUTES, type Interval } from "@/lib/agenda/free-slots";
import { LIGHT_DAY_MAX_ITEMS, STALE_ACTIVITY_DAYS, type EnergyLevel, type PlanBlock, type PlanContext, type ScreenType } from "./types";

const NEED: Record<EnergyLevel, number> = { baixa: 2, media: 3, alta: 4 };
const BREAK_MIN = 10;
const MAX_BLOCKS = 6;

/** Muito tempo de tela registrado hoje: o motor passa a priorizar atividades sem tela. */
export function isScreenHeavy(s: PlanContext["screenMinutes"]): boolean {
  return s.com >= 120 && s.com > s.sem;
}

/** Light day é ativado por energia 1–2 (decisão fechada) ou manualmente. */
export const isLowEnergy = (energy: number | null) => energy !== null && energy <= 2;

type Candidate = { score: number; durationMin: number; block: Omit<PlanBlock, "startMin" | "durationMin">; minDuration: number; id: string; habitRoutine?: string | null };

function slotsOf(ctx: PlanContext): Interval[] {
  const from = Math.max(ctx.wake, ctx.nowMin ?? ctx.wake);
  return freeSlots(ctx.busy, from, ctx.sleep, MIN_FREE_MINUTES);
}

const GENTLE_DEFAULTS: { title: string; minutes: number; screen: ScreenType }[] = [
  { title: "Alongar por 10 minutos", minutes: 10, screen: "sem_tela" },
  { title: "Beber um copo de água e respirar fundo", minutes: 5, screen: "sem_tela" },
  { title: "Ler uma página de um livro", minutes: 10, screen: "sem_tela" },
];

/** Dia leve: 2 ou 3 itens fáceis e prazerosos (mini-vitórias e atividades de energia baixa). Sem cobrança. */
export function buildLightPlan(ctx: PlanContext): PlanBlock[] {
  const excluded = new Set(ctx.exclude ?? []);
  const heavy = isScreenHeavy(ctx.screenMinutes);
  const pool: { id: string | null; title: string; minutes: number; screen: ScreenType; refType: string | null; prio: number }[] = [
    ...ctx.quickWins.filter((q) => q.energy === "baixa" && !excluded.has(q.id)).map((q) => ({ id: q.id, title: q.title, minutes: Math.min(q.minutes, 15), screen: q.screen, refType: "quick_win", prio: 2 })),
    ...ctx.activities.filter((a) => a.energy === "baixa" && !excluded.has(a.id)).map((a) => ({ id: a.id, title: a.name, minutes: Math.min(a.minutes, 30), screen: a.screen, refType: "activity", prio: 1 })),
  ];
  if (pool.length < 2) pool.push(...GENTLE_DEFAULTS.map((g) => ({ id: null, title: g.title, minutes: g.minutes, screen: g.screen, refType: null, prio: 0 })));
  pool.sort((a, b) => (heavy && a.screen !== b.screen ? (a.screen === "sem_tela" ? -1 : 1) : b.prio - a.prio));

  const slots = slotsOf(ctx);
  // Mesmo sem horário livre de 30 min, o Dia leve sugere itens curtos: usa o resto do dia.
  const fallback = slots.length ? slots : freeSlots(ctx.busy, Math.max(ctx.wake, ctx.nowMin ?? ctx.wake), ctx.sleep, 10);
  const out: PlanBlock[] = [];
  let si = 0, cursor = fallback[0]?.startMin ?? 0;
  for (const item of pool) {
    if (out.length >= LIGHT_DAY_MAX_ITEMS || si >= fallback.length) break;
    const slot = fallback[si];
    if (cursor + item.minutes > slot.endMin) { si++; cursor = fallback[si]?.startMin ?? 0; if (si >= fallback.length) break; }
    const s = fallback[si];
    if (cursor + item.minutes > s.endMin) continue;
    out.push({ startMin: cursor, durationMin: Math.max(5, item.minutes), kind: item.refType === "quick_win" ? "mini_vitoria" : "atividade", title: item.title, reason: "Dia leve: algo fácil e gostoso, sem cobrança", screen: item.screen, refType: item.refType, refId: item.id });
    cursor += item.minutes + 5;
  }
  return out;
}

/**
 * Sugestões para o trajeto (deslocamento): ouvir um podcast da lista ou ler (livro da fila ou artigo curto).
 * Ficam dentro do próprio trecho de deslocamento, que não conta como tempo livre; só para blocos que pediram isso.
 */
export function buildTravelSuggestions(ctx: PlanContext): PlanBlock[] {
  const excluded = new Set(ctx.exclude ?? []);
  const pods = ctx.podcasts.filter((p) => !excluded.has(p.id));
  const books = ctx.readingQueue.filter((r) => !excluded.has(r.id));
  const articles = ctx.shortArticles.filter((a) => !excluded.has(a.id));
  const out: PlanBlock[] = [];
  for (const slot of ctx.travelSlots) {
    const from = Math.max(slot.startMin, ctx.nowMin ?? slot.startMin);
    const length = slot.endMin - from;
    if (length < 15) continue; // trajeto curto ou já passou
    const base = { startMin: from, durationMin: Math.min(length, 90), reason: "Aproveita o deslocamento" };
    // um item por trecho: consome só o que foi usado (podcast, depois livro, depois artigo curto)
    if (pods.length) { const pod = pods.shift()!; out.push({ ...base, kind: "podcast", title: `Ouvir no trajeto: ${pod.title}`, screen: "com_tela", refType: "audio_item", refId: pod.id }); }
    else if (books.length) { const book = books.shift()!; out.push({ ...base, kind: "leitura", title: `Ler no trajeto: ${book.title}`, screen: "sem_tela", refType: "reading_item", refId: book.id }); }
    else if (articles.length) { const art = articles.shift()!; out.push({ ...base, kind: "artigo", title: `Ler no trajeto: ${art.title}`, screen: "com_tela", refType: "reading_item", refId: art.id }); }
  }
  return out;
}

export function buildRulesPlan(ctx: PlanContext): PlanBlock[] {
  if (ctx.lightDay) return buildLightPlan(ctx);
  return [...buildMainPlan(ctx), ...buildTravelSuggestions(ctx)];
}

function buildMainPlan(ctx: PlanContext): PlanBlock[] {

  const excluded = new Set(ctx.exclude ?? []);
  const level = ctx.energy ?? 3;
  const heavy = isScreenHeavy(ctx.screenMinutes);
  const used = new Set<string>();
  const out: PlanBlock[] = [];

  const candidates = (slot: Interval, startAt: number): Candidate[] => {
    const room = slot.endMin - startAt;
    const list: Candidate[] = [];
    for (const a of ctx.activities) {
      if (excluded.has(a.id) || NEED[a.energy] > level) continue;
      if (heavy && a.screen === "com_tela") continue; // dia com muita tela: só sugere sem tela
      const minutes = Math.min(a.minutes, room);
      if (minutes < Math.min(a.minutes, 20)) continue;
      const stale = a.daysSince === null ? 2 : a.daysSince >= STALE_ACTIVITY_DAYS ? 2 + Math.min(3, (a.daysSince - STALE_ACTIVITY_DAYS) / 7) : 0;
      const balance = heavy && a.screen === "sem_tela" ? 3 : 0;
      const reason = balance ? "Equilibra o tempo de tela de hoje" : a.daysSince === null ? "Você ainda não registrou esta atividade" : a.daysSince >= STALE_ACTIVITY_DAYS ? `Faz ${a.daysSince} dias que você não faz` : `Combina com a sua energia de hoje`;
      list.push({ id: a.id, score: 1 + stale + balance, durationMin: minutes, minDuration: 20, block: { kind: "atividade", title: a.name, reason, screen: a.screen, refType: "activity", refId: a.id } });
    }
    const book = ctx.readingQueue.find((r) => !excluded.has(r.id));
    if (book && room >= 20) list.push({ id: book.id, score: 2 + (heavy ? 1 : 0), durationMin: Math.min(30, room), minDuration: 20, block: { kind: "leitura", title: `Ler 15 páginas de ${book.title}`, reason: "Está na sua fila de leitura", screen: "sem_tela", refType: "reading_item", refId: book.id } });
    for (const h of ctx.pendingHabits) {
      if (excluded.has(h.id)) continue;
      if (h.routine === "noite" && startAt < 18 * 60) continue;
      if (h.routine === "manha" && startAt >= 12 * 60) continue;
      list.push({ id: h.id, score: 1.5, durationMin: Math.min(15, room), minDuration: 5, habitRoutine: h.routine, block: { kind: "habito", title: h.name, reason: "Hábito pendente de hoje", screen: null, refType: "habit", refId: h.id } });
    }
    return list.filter((c) => !used.has(c.id)).sort((a, b) => b.score - a.score);
  };

  for (const slot of slotsOf(ctx)) {
    let cursor = slot.startMin;
    while (slot.endMin - cursor >= MIN_FREE_MINUTES && out.length < MAX_BLOCKS) {
      if (heavy && !out.some((b) => b.kind === "pausa")) {
        out.push({ startMin: cursor, durationMin: 10, kind: "pausa", title: "Pausa sem tela: alongar e olhar pela janela", reason: "Bastante tempo de tela hoje", screen: "sem_tela", refType: null, refId: null });
        cursor += 10 + BREAK_MIN;
        continue;
      }
      const best = candidates(slot, cursor)[0];
      if (!best) break;
      used.add(best.id);
      out.push({ ...best.block, startMin: cursor, durationMin: best.durationMin });
      cursor += best.durationMin + BREAK_MIN;
    }
  }
  return out;
}

/** Sugestão pontual para "tenho X minutos". Menos de 20 min sugere artigo curto (ou mini-vitória). */
export function suggestForMinutes(ctx: PlanContext, minutes: number): PlanBlock | null {
  const start = ctx.nowMin ?? ctx.wake;
  const base = { startMin: start, durationMin: Math.max(5, minutes), screen: null as ScreenType | null };
  const excluded = new Set(ctx.exclude ?? []);
  if (minutes < 20) {
    const art = ctx.shortArticles.find((a) => !excluded.has(a.id));
    if (art) return { ...base, durationMin: Math.min(minutes, 15), kind: "artigo", title: `Ler: ${art.title}`, reason: `Cabe nos seus ${minutes} minutos`, screen: "com_tela", refType: "reading_item", refId: art.id };
    const q = ctx.quickWins.find((w) => w.minutes <= minutes && !excluded.has(w.id));
    if (q) return { ...base, durationMin: q.minutes, kind: "mini_vitoria", title: q.title, reason: `Cabe nos seus ${minutes} minutos`, screen: q.screen, refType: "quick_win", refId: q.id };
    return { ...base, durationMin: Math.min(minutes, 10), kind: "pausa", title: "Alongar e respirar", reason: "Uma pausa curta faz bem", screen: "sem_tela", refType: null, refId: null };
  }
  const level = ctx.energy ?? 3;
  const heavy = isScreenHeavy(ctx.screenMinutes);
  const act = ctx.activities
    .filter((a) => a.minutes <= minutes && NEED[a.energy] <= level && !excluded.has(a.id))
    .sort((a, b) => (heavy && a.screen !== b.screen ? (a.screen === "sem_tela" ? -1 : 1) : (b.daysSince ?? 99) - (a.daysSince ?? 99)))[0];
  if (act) return { ...base, durationMin: act.minutes, kind: "atividade", title: act.name, reason: act.daysSince === null ? "Você ainda não registrou esta atividade" : `Faz ${act.daysSince} dias que você não faz`, screen: act.screen, refType: "activity", refId: act.id };
  const book = ctx.readingQueue.find((r) => !excluded.has(r.id));
  if (book) return { ...base, durationMin: Math.min(minutes, 30), kind: "leitura", title: `Ler 15 páginas de ${book.title}`, reason: "Está na sua fila de leitura", screen: "sem_tela", refType: "reading_item", refId: book.id };
  return null;
}

export type Intent = { kind: "light" | "minutes" | "screenfree" | "plan" | "unknown"; minutes?: number };

/** Entende pedidos simples no modo regras (cansada, pouco tempo, sem tela). */
export function parseIntent(text: string): Intent {
  const t = text.toLowerCase();
  const m = /(\d{1,3})\s*(min|minutos)\b/.exec(t) ?? null;
  const h = /(\d{1,2})\s*(h|hora|horas)\b/.exec(t) ?? null;
  if (/cansad|exaust|sem energia|esgotad|sem for[cç]a|baixo astral|desanimad|dia leve/.test(t)) return { kind: "light" };
  if (m) return { kind: "minutes", minutes: Math.min(240, Number(m[1])) };
  if (h) return { kind: "minutes", minutes: Math.min(240, Number(h[1]) * 60) };
  if (/sem tela|desligar|menos tela|offline/.test(t)) return { kind: "screenfree" };
  if (/plano|organiz|reorganiz|meu dia|rotina/.test(t)) return { kind: "plan" };
  return { kind: "unknown" };
}

/** Plano que prioriza sem tela (pedido "menos tela"). */
export function buildScreenFreePlan(ctx: PlanContext): PlanBlock[] {
  const sem = { ...ctx, activities: ctx.activities.filter((a) => a.screen === "sem_tela"), screenMinutes: { com: Math.max(ctx.screenMinutes.com, 120), sem: 0 } };
  return buildRulesPlan(sem);
}
