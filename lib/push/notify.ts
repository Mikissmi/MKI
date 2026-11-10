import { query, queryOne } from "@/lib/db";
import { getSettings, type Settings } from "@/lib/settings";
import { fetchOccurrences } from "@/lib/agenda/queries";
import { ensureDayPlan } from "@/lib/planner/service";
import { pendingRetro } from "@/lib/retro";
import { localDateKey, localMinutes, parseTime, fmtMin, zonedToUtc } from "@/lib/time";
import { eventReminderDue, inQuietHours, MAX_DAILY_NOTICES, withinWindow } from "./rules";
import { sendPush, type PushPayload } from "./send";

/** Registra antes de enviar (índice único): duas chamadas ao mesmo tempo não mandam o aviso duas vezes. Se nada chegou, libera para tentar de novo. */
async function once(userId: string, kind: string, ref: string, payload: PushPayload): Promise<boolean> {
  const row = await queryOne<{ id: string }>("INSERT INTO push_log (user_id, kind, ref) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id", [userId, kind, ref]);
  if (!row) return false;
  const r = await sendPush(userId, payload);
  if (r.sent === 0) { await query("DELETE FROM push_log WHERE id = $1", [row.id]); return false; }
  return true;
}

export type NotifyRun = { users: number; sent: { plan: number; closing: number; events: number; retro: number }; skippedQuiet: number };

/** Decide e envia os avisos devidos agora. Chamado a cada poucos minutos por um agendador externo. */
export async function runNotify(now: Date = new Date()): Promise<NotifyRun> {
  const run: NotifyRun = { users: 0, sent: { plan: 0, closing: 0, events: 0, retro: 0 }, skippedQuiet: 0 };
  const users = await query<{ user_id: string }>("SELECT DISTINCT s.user_id FROM push_subscriptions s");
  const today = localDateKey(now), nowMin = localMinutes(now);
  const dayStart = zonedToUtc(today, 0);
  for (const { user_id: userId } of users) {
    const st: Settings = await getSettings(userId);
    const n = st.notify;
    if (!n.enabled) continue;
    run.users++;
    if (inQuietHours(nowMin, n.quietStart, n.quietEnd)) { run.skippedQuiet++; continue; }
    const counted = Number((await queryOne<{ c: string }>("SELECT count(*)::text AS c FROM push_log WHERE user_id = $1 AND sent_at >= $2 AND kind IN ('plan','closing','retro')", [userId, dayStart]))?.c ?? 0);
    let budget = MAX_DAILY_NOTICES - counted;

    if (n.plan && budget > 0 && withinWindow(nowMin, parseTime(n.planTime) ?? 450)) {
      await ensureDayPlan(userId, today, { today, allowAi: false }).catch(() => undefined); // o plano de hoje existe quando o aviso chega
      const occ = (await fetchOccurrences(userId, today, today)).filter((o) => !o.canceled && o.kind !== "travel");
      const blocks = Number((await queryOne<{ c: string }>("SELECT count(*)::text AS c FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND status IN ('proposed','accepted')", [userId, today]))?.c ?? 0);
      const total = occ.length + blocks;
      if (await once(userId, "plan", `plan:${today}`, { title: "Seu plano de hoje está pronto", body: total ? `${total} ${total === 1 ? "item" : "itens"} no seu dia. Toque para ver.` : "Seu dia está livre. Toque para ver sugestões.", url: "/", tag: "plan" })) { run.sent.plan++; budget--; }
    }
    if (n.closing && budget > 0 && withinWindow(nowMin, parseTime(n.closingTime) ?? 1290)) {
      const closed = await queryOne("SELECT 1 FROM daily_closings WHERE user_id = $1 AND date = $2::date", [userId, today]);
      if (!closed && (await once(userId, "closing", `closing:${today}`, { title: "Hora de fechar o dia", body: "Um minuto para ver como foi e escolher o que fica para amanhã.", url: "/fechamento", tag: "closing" }))) { run.sent.closing++; budget--; }
    }
    if (n.retro && budget > 0) {
      const r = await pendingRetro(userId, today);
      if (r && (await once(userId, "retro", `retro:${r.period}:${r.start}`, { title: r.period === "semana" ? "Sua retrospectiva da semana está pronta" : "Sua retrospectiva do mês está pronta", body: "Veja como foi: humor, hábitos, leituras e gastos.", url: `/retrospectivas?p=${r.period}&d=${r.start}`, tag: "retro" }))) { run.sent.retro++; budget--; }
    }
    if (n.events) {
      for (const o of await fetchOccurrences(userId, today, today)) {
        if (o.canceled || o.kind !== "event" || !eventReminderDue(nowMin, o.startMin, n.eventLeadMin)) continue;
        const left = o.startMin - nowMin;
        if (await once(userId, "event", `event:${o.key}`, { title: o.title, body: `Começa às ${fmtMin(o.startMin)}${left > 0 ? ` (em ${left} min)` : ""}${o.location ? ` · ${o.location}` : ""}`, url: "/agenda", tag: `event-${o.key}` })) run.sent.events++;
      }
    }
  }
  return run;
}
