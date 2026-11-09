import { describe, expect, it } from "vitest";
import { buildRulesPlan, buildLightPlan, buildTravelSuggestions, isScreenHeavy, parseIntent, suggestForMinutes } from "./rules";
import { aiPlanSchema, sanitizeAiBlocks, sanitizeMoves } from "./validate";
import { busyIntervals, expandRoutine, type RoutineBlock, type RoutineOverride } from "@/lib/agenda/occurrences";
import { routineBlockSchema, overrideSchema } from "@/lib/agenda/schemas";
import type { PlanContext } from "./types";

const base = (o: Partial<PlanContext> = {}): PlanContext => ({
  date: "2026-11-09", nowMin: 9 * 60, wake: 7 * 60, sleep: 23 * 60, busy: [{ startMin: 9 * 60, endMin: 12 * 60 }, { startMin: 13 * 60, endMin: 18 * 60 }],
  mood: 3, energy: 3, lightDay: false, pendingHabits: [], readingQueue: [{ id: "b1", title: "O caminho", kind: "livro" }], shortArticles: [{ id: "a1", title: "Pausa produtiva" }],
  activities: [
    { id: "x1", name: "Desenhar", minutes: 45, energy: "media", screen: "sem_tela", daysSince: 10 },
    { id: "x2", name: "Jogar", minutes: 60, energy: "baixa", screen: "com_tela", daysSince: 1 },
    { id: "x3", name: "Correr", minutes: 30, energy: "alta", screen: "sem_tela", daysSince: 20 },
  ],
  quickWins: [{ id: "q1", title: "Alongar 10 min", minutes: 10, energy: "baixa", screen: "sem_tela" }, { id: "q2", title: "Ouvir um álbum", minutes: 10, energy: "baixa", screen: "com_tela" }],
  screenMinutes: { com: 0, sem: 0 }, flexBlocks: [], travelSlots: [], podcasts: [], ...o,
});

describe("motor de regras", () => {
  it("energia média não sugere atividade de energia alta", () => {
    const plan = buildRulesPlan(base());
    expect(plan.some((b) => b.title === "Correr")).toBe(false);
  });
  it("atividade parada há mais de 7 dias sobe na prioridade", () => {
    const plan = buildRulesPlan(base({ busy: [{ startMin: 9 * 60, endMin: 20 * 60 }] }));
    expect(plan[0].title).toBe("Desenhar");
    expect(plan[0].reason).toMatch(/10 dias/);
  });
  it("só usa horários livres de 30 min ou mais e não bate com compromissos", () => {
    const ctx = base({ busy: [{ startMin: 9 * 60, endMin: 12 * 60 }, { startMin: 12 * 60 + 20, endMin: 22 * 60 + 40 }] });
    expect(buildRulesPlan(ctx)).toEqual([]); // lacunas de 20 min (12:00–12:20) e 20 min (22:40–23:00)
  });
  it("não sugere nada no passado", () => {
    const plan = buildRulesPlan(base({ nowMin: 19 * 60, busy: [] }));
    expect(plan.every((b) => b.startMin >= 19 * 60)).toBe(true);
  });
  it("muito tempo de tela prioriza sem tela e sugere pausa", () => {
    const ctx = base({ busy: [], screenMinutes: { com: 240, sem: 30 } });
    expect(isScreenHeavy(ctx.screenMinutes)).toBe(true);
    const plan = buildRulesPlan(ctx);
    expect(plan[0].kind).toBe("pausa");
    expect(plan.filter((b) => b.kind === "atividade").every((b) => b.screen === "sem_tela")).toBe(true);
  });
  it("hábito noturno só aparece à noite", () => {
    const ctx = base({ busy: [], pendingHabits: [{ id: "h1", name: "Dormir até 23h", routine: "noite" }] });
    const morning = buildRulesPlan({ ...ctx, nowMin: 8 * 60 });
    const first = morning.find((b) => b.refId === "h1");
    expect(first === undefined || first.startMin >= 18 * 60).toBe(true);
  });
  it("no máximo 6 blocos por dia", () => {
    expect(buildRulesPlan(base({ busy: [], nowMin: 7 * 60 })).length).toBeLessThanOrEqual(6);
  });
});

describe("Dia leve", () => {
  it("usa só energia baixa, 2 a 3 itens", () => {
    const plan = buildLightPlan(base({ lightDay: true, energy: 1 }));
    expect(plan.length).toBeGreaterThanOrEqual(2);
    expect(plan.length).toBeLessThanOrEqual(3);
    expect(plan.some((b) => b.title === "Correr")).toBe(false);
    expect(plan.every((b) => b.durationMin <= 30)).toBe(true);
  });
  it("sem mini-vitórias cadastradas, usa sugestões gentis padrão", () => {
    const plan = buildLightPlan(base({ lightDay: true, quickWins: [], activities: [] }));
    expect(plan.length).toBeGreaterThanOrEqual(2);
  });
  it("buildRulesPlan delega ao Dia leve", () => {
    expect(buildRulesPlan(base({ lightDay: true })).length).toBeLessThanOrEqual(3);
  });
});

describe("sugestão por tempo e intenção", () => {
  it("menos de 20 min sugere artigo curto", () => {
    expect(suggestForMinutes(base(), 15)?.kind).toBe("artigo");
  });
  it("40 min sugere atividade que cabe", () => {
    const s = suggestForMinutes(base({ energy: 3 }), 40);
    expect(s?.durationMin).toBeLessThanOrEqual(40);
  });
  it("entende cansaço, minutos e sem tela", () => {
    expect(parseIntent("hoje estou cansada, reorganiza meu dia").kind).toBe("light");
    expect(parseIntent("tenho 40 minutos livres")).toEqual({ kind: "minutes", minutes: 40, day: undefined });
    expect(parseIntent("quero um dia sem tela").kind).toBe("screenfree");
    expect(parseIntent("qual a capital da França?").kind).toBe("unknown");
  });
});

describe("pedidos com dia e semana", () => {
  it("entende 'amanhã' e mantém a intenção", () => {
    expect(parseIntent("Vamos organizar meu dia amanhã")).toEqual({ kind: "plan", day: "amanha" });
    expect(parseIntent("amanhã vou estar cansada")).toEqual({ kind: "light", day: "amanha" });
    expect(parseIntent("quero um dia sem tela amanhã")).toEqual({ kind: "screenfree", day: "amanha" });
    expect(parseIntent("amanhã")).toEqual({ kind: "plan", day: "amanha" });
  });
  it("entende pedido da semana (sem confundir com 'hoje')", () => {
    expect(parseIntent("Organize minha semana")).toEqual({ kind: "week" });
    expect(parseIntent("planeja os próximos dias")).toEqual({ kind: "week" });
    expect(parseIntent("organiza meu dia").day).toBeUndefined();
  });
  it("sem pedido reconhecível continua 'unknown'", () => {
    expect(parseIntent("qual a capital da França?")).toEqual({ kind: "unknown" });
  });
});

describe("validação da resposta da IA", () => {
  it("rejeita formato inválido", () => {
    expect(aiPlanSchema.safeParse({ blocks: [{ start: "xx", durationMin: 30, title: "a" }] }).success).toBe(false);
    expect(aiPlanSchema.safeParse("texto solto").success).toBe(false);
  });
  it("descarta blocos que batem com compromissos, passado ou fora da janela", () => {
    const plan = aiPlanSchema.parse({ blocks: [
      { start: "10:00", durationMin: 30, kind: "leitura", title: "bate com trabalho", reason: "" },
      { start: "08:00", durationMin: 30, kind: "atividade", title: "passado", reason: "" },
      { start: "12:00", durationMin: 30, kind: "atividade", title: "ok", reason: "" },
      { start: "22:50", durationMin: 30, kind: "atividade", title: "depois de dormir", reason: "" },
    ] });
    const out = sanitizeAiBlocks(plan, base());
    expect(out.map((b) => b.title)).toEqual(["ok"]);
  });
});

// ---------- 10.2: blocos flexíveis e deslocamento ----------
const MON = "2026-11-09";
const job = (o: Partial<RoutineBlock> = {}): RoutineBlock => ({
  id: "job", title: "Trabalho", weekdays: [1, 2, 3, 4, 5], startMin: 480, endMin: 960, category: "trabalho", mode: "flexible",
  startEarliest: 480, startLatest: 600, preferredStart: 480, durationMin: 480, travelTo: 40, travelFrom: 50, travelMode: "onibus", travelSuggestions: false, ...o,
});
const ovr = (o: Partial<RoutineOverride> = {}): RoutineOverride => ({ id: "o1", blockId: "job", date: MON, startActual: null, skipTravel: false, canceled: false, ...o });

/** Contexto do dia montado como o app monta: a rotina (com deslocamento) vira ocupado. */
function dayCtx(block: RoutineBlock, overrides: RoutineOverride[], extra: Partial<PlanContext> = {}): PlanContext {
  const occs = expandRoutine([block], MON, MON, overrides);
  return base({
    date: MON, nowMin: 6 * 60, busy: busyIntervals(occs), mood: 3, energy: 4,
    flexBlocks: occs.filter((o) => o.kind === "routine" && o.flexible && !o.canceled).map((o) => ({ blockId: o.blockId!, title: o.title, startMin: o.startMin, durationMin: o.endMin - o.startMin, earliest: o.window!.earliest, latest: o.window!.latest, confirmed: Boolean(o.confirmed) })),
    travelSlots: occs.filter((o) => o.kind === "travel" && o.suggestions && !o.canceled).map((o) => ({ startMin: o.startMin, endMin: o.endMin })),
    ...extra,
  });
}
const overlapsAny = (b: { startMin: number; durationMin: number }, busy: { startMin: number; endMin: number }[]) => busy.some((x) => b.startMin < x.endMin && x.startMin < b.startMin + b.durationMin);

describe("motor de regras com blocos flexíveis e deslocamento", () => {
  it("nunca coloca atividade sobre o bloco nem sobre o deslocamento (horário preferido)", () => {
    const ctx = dayCtx(job(), []);
    const plan = buildRulesPlan(ctx).filter((b) => b.kind !== "podcast" && b.refType !== "reading_item");
    expect(plan.length).toBeGreaterThan(0);
    for (const b of plan) expect(overlapsAny(b, ctx.busy)).toBe(false);
  });
  it("usa o horário real confirmado: com início às 09:00 o tempo antes do trabalho muda", () => {
    const preferred = dayCtx(job(), []);          // ocupado 07:20–16:50
    const actual = dayCtx(job(), [ovr({ startActual: 540 })]); // ocupado 08:20–17:50
    expect(preferred.busy).toContainEqual({ startMin: 440, endMin: 480 });   // ida 07:20–08:00
    expect(actual.busy).toContainEqual({ startMin: 500, endMin: 540 });      // ida 08:20–09:00
    expect(actual.busy).toContainEqual({ startMin: 1020, endMin: 1070 });    // volta 17:00–17:50
    for (const ctx of [preferred, actual]) for (const b of buildRulesPlan(ctx)) if (b.refType !== "reading_item" && b.kind !== "podcast") expect(overlapsAny(b, ctx.busy)).toBe(false);
  });
  it("home office (sem deslocamento) libera o tempo do trajeto; cancelar libera o bloco todo", () => {
    expect(dayCtx(job(), [ovr({ skipTravel: true })]).busy).toEqual([{ startMin: 480, endMin: 960 }]);
    expect(dayCtx(job(), [ovr({ canceled: true })]).busy).toEqual([]);
  });
  it("bloco fixo com deslocamento também é respeitado", () => {
    const ctx = dayCtx(job({ mode: "fixed", startMin: 540, endMin: 1080, travelTo: 30, travelFrom: 30 }), []);
    expect(ctx.busy).toContainEqual({ startMin: 510, endMin: 540 });
    for (const b of buildRulesPlan(ctx)) if (b.refType !== "reading_item") expect(overlapsAny(b, ctx.busy)).toBe(false);
  });
});

describe("sugestões no trajeto", () => {
  const withTravel = (o: Partial<PlanContext> = {}) => dayCtx(job({ travelSuggestions: true }), [], { podcasts: [{ id: "p1", title: "Café e ideias" }], ...o });
  it("propõe podcast durante o deslocamento (dentro do trecho, que não é tempo livre)", () => {
    const ctx = withTravel();
    const s = buildTravelSuggestions(ctx);
    expect(s).toHaveLength(2); // ida e volta
    expect(s[0]).toMatchObject({ kind: "podcast", startMin: 440, durationMin: 40, refId: "p1" });
    // usa um item por trecho: sem segundo podcast, a volta vira leitura
    expect(s[1].kind).toBe("leitura");
    expect(s[1].startMin).toBe(960);
  });
  it("sem podcast usa o livro da fila e depois um artigo curto", () => {
    const s = buildTravelSuggestions(withTravel({ podcasts: [] }));
    expect(s.map((b) => b.kind)).toEqual(["leitura", "artigo"]);
  });
  it("só quando o bloco pediu sugestões, e nada depois que o trajeto já passou", () => {
    expect(buildTravelSuggestions(dayCtx(job({ travelSuggestions: false }), []))).toEqual([]);
    expect(buildTravelSuggestions(withTravel({ nowMin: 17 * 60 }))).toEqual([]);
  });
  it("trajeto curto (menos de 15 min) não recebe sugestão", () => {
    expect(buildTravelSuggestions(dayCtx(job({ travelSuggestions: true, travelTo: 10, travelFrom: 10 }), [], { podcasts: [{ id: "p1", title: "X" }] }))).toEqual([]);
  });
  it("o plano por regras inclui as sugestões do trajeto, menos no Dia leve", () => {
    expect(buildRulesPlan(withTravel()).some((b) => b.kind === "podcast")).toBe(true);
    expect(buildRulesPlan(withTravel({ lightDay: true })).some((b) => b.kind === "podcast")).toBe(false);
  });
});

describe("IA propõe mover o início (só proposta)", () => {
  const ctx = () => dayCtx(job(), [], { nowMin: 6 * 60 });
  const plan = (moves: { title: string; start: string; reason?: string }[]) => aiPlanSchema.parse({ blocks: [], moves });
  it("aceita proposta dentro da janela de bloco não confirmado", () => {
    const m = sanitizeMoves(plan([{ title: "Trabalho", start: "09:30", reason: "Cabe a corrida antes" }]), ctx());
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ kind: "ajuste", startMin: 570, refType: "routine_block", refId: "job", title: "Começar Trabalho às 09:30" });
  });
  it("descarta fora da janela, igual ao atual, no passado, bloco desconhecido ou já confirmado", () => {
    expect(sanitizeMoves(plan([{ title: "Trabalho", start: "07:00" }, { title: "Trabalho", start: "10:30" }]), ctx())).toEqual([]);
    expect(sanitizeMoves(plan([{ title: "Trabalho", start: "08:00" }]), ctx())).toEqual([]);
    expect(sanitizeMoves(plan([{ title: "Trabalho", start: "08:30" }]), { ...ctx(), nowMin: 9 * 60 })).toEqual([]);
    expect(sanitizeMoves(plan([{ title: "Academia", start: "09:00" }]), ctx())).toEqual([]);
    expect(sanitizeMoves(plan([{ title: "Trabalho", start: "09:00" }]), dayCtx(job(), [ovr({ startActual: 540 })]))).toEqual([]);
  });
  it("no máximo uma proposta por bloco; resposta sem 'moves' continua válida", () => {
    expect(sanitizeMoves(plan([{ title: "Trabalho", start: "09:00" }, { title: "Trabalho", start: "09:30" }]), ctx())).toHaveLength(1);
    expect(aiPlanSchema.safeParse({ blocks: [] }).success).toBe(true);
  });
});

describe("formulário do bloco: fixo e flexível", () => {
  const ok = (o: Record<string, unknown>) => routineBlockSchema.safeParse({ title: "Trabalho", weekdays: ["1", "2"], category: "trabalho", mode: "fixed", start: "09:00", end: "18:00", ...o });
  const flex = (o: Record<string, unknown> = {}) => ok({ mode: "flexible", start: "", end: "", earliest: "08:00", latest: "10:00", preferred: "09:00", duration_hours: "8", travel_to: "40", travel_from: "50", travel_mode: "onibus", ...o });
  it("aceita o exemplo do doc (08:00–10:00, 8 h, ida 40, volta 50)", () => {
    const r = flex();
    expect(r.success).toBe(true);
    expect(r.success && r.data).toMatchObject({ mode: "flexible", duration_hours: 480, travel_to: 40, travel_from: 50, travel_mode: "onibus" });
  });
  it("aceita duração com vírgula (7,5 h) e deslocamento em branco", () => {
    const r = flex({ duration_hours: "7,5", travel_to: "", travel_from: "" });
    expect(r.success && r.data).toMatchObject({ duration_hours: 450, travel_to: 0, travel_from: 0 });
  });
  it("recusa janela invertida, preferido fora da janela, sem duração ou passando da meia-noite", () => {
    expect(flex({ latest: "07:00" }).success).toBe(false);
    expect(flex({ preferred: "11:00" }).success).toBe(false);
    expect(flex({ duration_hours: "" }).success).toBe(false);
    expect(flex({ duration_hours: "14" }).success).toBe(false); // 10:00 + 14 h passa de 23:59
  });
  it("recusa deslocamento negativo ou absurdo e meio de transporte desconhecido", () => {
    expect(flex({ travel_to: "-5" }).success).toBe(false);
    expect(flex({ travel_from: "700" }).success).toBe(false);
    expect(flex({ travel_mode: "foguete" }).success).toBe(false);
  });
  it("modo fixo continua exigindo início e fim válidos", () => {
    expect(ok({}).success).toBe(true);
    expect(ok({ end: "08:00" }).success).toBe(false);
    expect(ok({ start: "" }).success).toBe(false);
  });
  it("exceção do dia: horário e interruptores", () => {
    expect(overrideSchema.safeParse({ block_id: crypto.randomUUID(), date: MON, start_actual: "09:00", skip_travel: "on" }).success).toBe(true);
    expect(overrideSchema.safeParse({ block_id: "x", date: MON }).success).toBe(false);
    expect(overrideSchema.safeParse({ block_id: crypto.randomUUID(), date: "2026-13-40" }).success).toBe(false);
  });
});
