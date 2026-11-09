import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { ensureDayPlan } from "@/lib/planner/service";
import { isDateKey, localDateKey } from "@/lib/time";

const body = z.object({ date: z.string().refine(isDateKey).optional(), force: z.boolean().optional() });

/** Gera (ou reaproveita do cache) o plano do dia: IA primeiro, motor de regras como plano B. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "pedido inválido" }, { status: 400 });
  const result = await ensureDayPlan(user.id, parsed.data.date ?? localDateKey(), { force: parsed.data.force });
  return NextResponse.json(result);
}
