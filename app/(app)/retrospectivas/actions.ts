"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getRetro, periodStart } from "@/lib/retro";
import { isDateKey } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

/** Reflexão curta escrita por você, guardada junto da retrospectiva. */
export async function saveReflection(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ period: z.enum(["semana", "mes"]), start: z.string().refine(isDateKey), reflection: z.string().trim().max(2000) }).safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Não foi possível salvar a reflexão." };
  const { period, start, reflection } = parsed.data;
  await getRetro(u.id, period, periodStart(period, start)); // garante que a linha existe
  await query("UPDATE retrospectives SET reflection = $4 WHERE user_id = $1 AND period = $2 AND start_on = $3::date", [u.id, period, periodStart(period, start), reflection || null]);
  revalidatePath("/", "layout");
  return { ok: true };
}
