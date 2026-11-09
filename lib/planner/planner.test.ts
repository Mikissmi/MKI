import { describe, expect, it } from "vitest";
import { buildRulesPlan, buildLightPlan, isScreenHeavy, parseIntent, suggestForMinutes } from "./rules";
import { aiPlanSchema, sanitizeAiBlocks } from "./validate";
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
  screenMinutes: { com: 0, sem: 0 }, ...o,
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
    expect(parseIntent("tenho 40 minutos livres")).toEqual({ kind: "minutes", minutes: 40 });
    expect(parseIntent("quero um dia sem tela").kind).toBe("screenfree");
    expect(parseIntent("qual a capital da França?").kind).toBe("unknown");
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
