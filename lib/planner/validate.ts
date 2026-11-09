import { z } from "zod";
import { fmtMin, parseTime } from "@/lib/time";
import type { Interval } from "@/lib/agenda/free-slots";
import type { PlanBlock, PlanContext } from "./types";

const KINDS = ["leitura", "atividade", "habito", "pausa", "mini_vitoria", "exercicio", "artigo"] as const;

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
