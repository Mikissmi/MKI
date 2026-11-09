"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { checkinSchema, zodState, type FormState } from "@/lib/agenda/schemas";
import { localDateKey } from "@/lib/time";
import { ensureDayPlan } from "@/lib/planner/service";

export async function saveCheckin(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = checkinSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return parsed.error.issues.some((i) => ["mood", "energy"].includes(String(i.path[0])))
    ? { error: "Escolha humor e energia." } : zodState(parsed.error);
  const { mood, energy, note } = parsed.data;
  await query(
    `INSERT INTO checkins (user_id, date, mood, energy, note) VALUES ($1, $2::date, $3, $4, $5)
     ON CONFLICT (user_id, date) DO UPDATE SET mood=$3, energy=$4, note=$5, updated_at=now()`,
    [user.id, localDateKey(), mood, energy, note],
  );
  // Energia 1 ou 2 ativa o Dia leve: o plano encolhe na hora (pelas regras, sem gastar chamada de IA).
  if (energy <= 2) await ensureDayPlan(user.id, localDateKey(), { allowAi: false });
  revalidatePath("/", "layout");
  return { ok: true };
}
