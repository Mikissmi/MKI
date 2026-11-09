"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ensureDayPlan } from "@/lib/planner/service";
import { loadPlanContext } from "@/lib/planner/context";
import { buildRulesPlan, suggestForMinutes } from "@/lib/planner/rules";
import { localDateKey } from "@/lib/time";

const idOf = (f: FormData) => z.string().uuid().safeParse(f.get("id"));
const done = () => revalidatePath("/", "layout");

export async function acceptBlock(form: FormData) {
  const user = await requireUser(); const id = idOf(form); if (!id.success) return;
  await query("UPDATE plan_blocks SET status = 'accepted' WHERE id = $1 AND user_id = $2", [id.data, user.id]); done();
}

export async function dismissBlock(form: FormData) {
  const user = await requireUser(); const id = idOf(form); if (!id.success) return;
  await query("UPDATE plan_blocks SET status = 'dismissed' WHERE id = $1 AND user_id = $2", [id.data, user.id]); done();
}

export async function removeBlock(form: FormData) {
  const user = await requireUser(); const id = idOf(form); if (!id.success) return;
  await query("DELETE FROM plan_blocks WHERE id = $1 AND user_id = $2", [id.data, user.id]); done();
}

export async function acceptAllBlocks() {
  const user = await requireUser();
  await query("UPDATE plan_blocks SET status = 'accepted' WHERE user_id = $1 AND date = $2::date AND status = 'proposed'", [user.id, localDateKey()]); done();
}

/** "Trocar": o motor de regras escolhe outra sugestão para o mesmo horário (sem gastar chamadas de IA). */
export async function swapBlock(form: FormData) {
  const user = await requireUser(); const id = idOf(form); if (!id.success) return;
  const old = await queryOne<{ date: string; start_min: number; duration_min: number; ref_id: string | null }>(
    "SELECT date::text AS date, start_min, duration_min, ref_id FROM plan_blocks WHERE id = $1 AND user_id = $2", [id.data, user.id]);
  if (!old) return;
  const today = localDateKey();
  const current = await query<{ ref_id: string | null }>("SELECT ref_id FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND status <> 'dismissed'", [user.id, old.date]);
  const exclude = current.map((c) => c.ref_id).filter((x): x is string => Boolean(x));
  const { ctx } = await loadPlanContext(user.id, old.date, { today, exclude });
  const alt = buildRulesPlan(ctx).sort((a, b) => Math.abs(a.startMin - old.start_min) - Math.abs(b.startMin - old.start_min))[0]
    ?? suggestForMinutes({ ...ctx, nowMin: old.start_min }, old.duration_min);
  if (!alt) { await query("UPDATE plan_blocks SET status = 'dismissed' WHERE id = $1 AND user_id = $2", [id.data, user.id]); return done(); }
  await query(
    `UPDATE plan_blocks SET title=$3, reason=$4, kind=$5, duration_min=$6, screen_type=$7, ref_type=$8, ref_id=$9, source='rules' WHERE id=$1 AND user_id=$2`,
    [id.data, user.id, alt.title, alt.reason, alt.kind, Math.min(alt.durationMin, Math.max(5, old.duration_min)), alt.screen, alt.refType, alt.refId],
  );
  done();
}

export async function refreshPlan() {
  const user = await requireUser();
  await ensureDayPlan(user.id, localDateKey(), { force: true });
  done();
}

/** Liga/desliga o Dia leve manualmente (o plano é refeito pelas regras, na hora). */
export async function toggleLightDay() {
  const user = await requireUser();
  const today = localDateKey();
  const row = await queryOne<{ light_day: boolean }>("SELECT light_day FROM day_plans WHERE user_id = $1 AND date = $2::date", [user.id, today]);
  const next = !(row?.light_day ?? false);
  await query(
    `INSERT INTO day_plans (user_id, date, input_hash, source, light_day) VALUES ($1,$2::date,'',  'rules', $3)
     ON CONFLICT (user_id, date) DO UPDATE SET light_day = $3, input_hash = ''`, [user.id, today, next]);
  await ensureDayPlan(user.id, today, { allowAi: false, force: true });
  done();
}
