"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { optText } from "@/lib/schema-kit";
import { localDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const schema = z.object({ line: optText(200), p1: optText(120), p2: optText(120), p3: optText(120), focus: optText(140) });

/** Guarda o fechamento do dia: uma linha sobre o dia, até 3 prioridades para amanhã e o foco de amanhã. */
export async function saveClosing(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Confira os campos (textos curtos)." };
  const d = parsed.data;
  const priorities = [d.p1, d.p2, d.p3].filter((x): x is string => Boolean(x));
  await query(
    `INSERT INTO daily_closings (user_id, date, line, priorities, focus) VALUES ($1,$2::date,$3,$4,$5)
     ON CONFLICT (user_id, date) DO UPDATE SET line = $3, priorities = $4, focus = $5, updated_at = now()`, [u.id, localDateKey(), d.line, priorities, d.focus]);
  revalidatePath("/", "layout");
  return { ok: true };
}
