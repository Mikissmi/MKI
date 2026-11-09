import { z } from "zod";
import { fmtMin, parseTime } from "@/lib/time";
import type { Interval } from "@/lib/agenda/free-slots";
import type { PlanBlock, PlanContext } from "./types";

const KINDS = ["leitura", "atividade", "habito", "pausa", "mini_vitoria", "exercicio", "artigo", "podcast"] as const;

/** Formato que a IA precisa devolver. Tudo é validado antes de aparecer. */
export const aiPlanSchema = z.object({
  reply: z.string().trim().max(600).optional(),
  blocks: z.array(z.object({
    start: z.string().refine((s) => parseTime(s) !== null, "horário inválido"),
    durationMin: z.coerce.number().int().min(5).max(240),
    kind: z.enum(KINDS).catch("atividade"),
    title: z.string().trim().min(1).max(120),
    reason: z.string().trim().max(200).default(""),
  })).max(12).default([]),
  /** Propostas de mover o início de um bloco flexível dentro da janela (só proposta: nada muda sem aceitar). */
  // opcional e tolerante: uma proposta mal formada é ignorada em sanitizeMoves e nunca derruba o plano inteiro
  moves: z.array(z.object({
    title: z.string().trim().min(1).max(120).catch(""),
    start: z.string().catch(""),
    reason: z.string().trim().max(200).catch(""),
  })).catch([]).default([]),
});

export type AiPlan = z.infer<typeof aiPlanSchema>;

const overlaps = (a: Interval, b: Interval) => a.startMin < b.endMin && b.startMin < a.endMin;

/** Converte a resposta da IA em blocos válidos: descarta os que batem com compromissos fixos, saem da janela ou ficam no passado. */
export function sanitizeAiBlocks(plan: AiPlan, ctx: PlanContext): PlanBlock[] {
  const earliest = Math.max(ctx.wake, ctx.nowMin ?? ctx.wake);
  const taken: Interval[] = [...ctx.busy];
  const out: PlanBlock[] = [];
  for (const b of [...plan.blocks].sort((x, y) => parseTime(x.start)! - parseTime(y.start)!)) {
    const startMin = parseTime(b.start)!;
    const iv = { startMin, endMin: startMin + b.durationMin };
    if (startMin < earliest || iv.endMin > ctx.sleep) continue;
    if (taken.some((t) => overlaps(t, iv))) continue;
    taken.push(iv);
    out.push({ startMin, durationMin: b.durationMin, kind: b.kind, title: b.title, reason: b.reason, screen: null, refType: null, refId: null });
  }
  return out;
}

export const describeBlock = (b: PlanBlock) => `${fmtMin(b.startMin)} (${b.durationMin} min) ${b.title}`;

/**
 * Movimentos propostos pela IA viram sugestões "ajuste". Só valem para bloco flexível de hoje que ainda não foi confirmado,
 * com o novo início dentro da janela, no futuro e diferente do atual. O resto é descartado.
 */
export function sanitizeMoves(plan: AiPlan, ctx: PlanContext): PlanBlock[] {
  const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const out: PlanBlock[] = [];
  for (const m of plan.moves) {
    const start = parseTime(m.start);
    if (start === null || !m.title) continue; // horário inválido (ex.: "24:00") ou sem título: ignora só esta proposta
    const block = ctx.flexBlocks.find((b) => norm(m.title).includes(norm(b.title)) || norm(b.title).includes(norm(m.title)));
    if (!block || block.confirmed || out.some((o) => o.refId === block.blockId)) continue;
    if (start < block.earliest || start > block.latest || start === block.startMin) continue;
    if (ctx.nowMin !== null && start < ctx.nowMin) continue;
    out.push({ startMin: start, durationMin: Math.min(block.durationMin, 720), kind: "ajuste", title: `Começar ${block.title} às ${fmtMin(start)}`, reason: m.reason || "Encaixa melhor as suas atividades", screen: null, refType: "routine_block", refId: block.blockId });
  }
  return out;
}
