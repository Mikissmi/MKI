"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { dismissWelcome } from "@/lib/presence";
import { ensureDayPlan } from "@/lib/planner/service";
import { hideMemory, swapMemory } from "@/lib/memory";
import { localDateKey } from "@/lib/time";

const done = () => revalidatePath("/", "layout");

/** Boas-vindas: "Começar com um Dia leve" liga o Dia leve de hoje (plano curto, pelas regras) e fecha o aviso. */
export async function startLightRestart() {
  const user = await requireUser();
  const today = localDateKey();
  await query(
    `INSERT INTO day_plans (user_id, date, input_hash, source, light_day) VALUES ($1,$2::date,'','rules',true)
     ON CONFLICT (user_id, date) DO UPDATE SET light_day = true, input_hash = ''`, [user.id, today]);
  await ensureDayPlan(user.id, today, { allowAi: false, force: true });
  await dismissWelcome(user.id);
  done();
}

export async function continueNormal() {
  const user = await requireUser();
  await dismissWelcome(user.id);
  done();
}

export async function otherMemory() { const u = await requireUser(); await swapMemory(u.id, localDateKey()); done(); }
export async function notNowMemory() { const u = await requireUser(); await hideMemory(u.id, localDateKey()); done(); }
