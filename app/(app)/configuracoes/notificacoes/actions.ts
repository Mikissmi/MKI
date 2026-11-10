"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings, patchSettings } from "@/lib/settings";
import { pushConfig, pushSink } from "@/lib/push/config";
import { sendPush, subscriptionsOf } from "@/lib/push/send";
import { reqInt } from "@/lib/schema-kit";
import { parseTime } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

const done = () => revalidatePath("/configuracoes/notificacoes");
const on = (v: unknown) => v === "on" || v === "true";
const hhmm = z.string().refine((t) => parseTime(t) !== null, "Horário inválido");

export async function saveNotify(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const raw = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = z.object({ lead: reqInt(1, 180), planTime: hhmm, closingTime: hhmm, quietStart: hhmm, quietEnd: hhmm }).safeParse(raw);
  if (!parsed.success) return { error: "Confira os horários e os minutos.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const cur = (await getSettings(u.id)).notify;
  await patchSettings(u.id, { notify: { ...cur, enabled: on(raw.enabled), plan: on(raw.plan), closing: on(raw.closing), events: on(raw.events), retro: on(raw.retro), eventLeadMin: parsed.data.lead, planTime: parsed.data.planTime, closingTime: parsed.data.closingTime, quietStart: parsed.data.quietStart, quietEnd: parsed.data.quietEnd } });
  done();
  return { ok: true };
}

/** "Desligar tudo": nenhum aviso é enviado e as inscrições dos aparelhos são apagadas. */
export async function disableAllNotify(): Promise<void> {
  const u = await requireUser();
  const cur = (await getSettings(u.id)).notify;
  await patchSettings(u.id, { notify: { ...cur, enabled: false, plan: false, closing: false, events: false, retro: false } });
  await query("DELETE FROM push_subscriptions WHERE user_id = $1", [u.id]);
  done();
}

/** Notificação de teste: vai na hora para todos os aparelhos inscritos (é um pedido seu, então ignora o horário silencioso). */
export async function sendTestPush(): Promise<{ ok: boolean; message: string }> {
  const u = await requireUser();
  if (!pushConfig().configured && !pushSink()) return { ok: false, message: "As chaves das notificações ainda não foram configuradas no servidor." };
  if ((await subscriptionsOf(u.id)).length === 0) return { ok: false, message: "Nenhum aparelho inscrito. Ligue as notificações neste aparelho primeiro." };
  const r = await sendPush(u.id, { title: "MKI", body: "Teste: as notificações estão funcionando.", url: "/configuracoes/notificacoes", tag: "test" });
  done();
  if (r.sent > 0) return { ok: true, message: `Enviei para ${r.sent} ${r.sent === 1 ? "aparelho" : "aparelhos"}. Pode fechar o app para conferir.` };
  return { ok: false, message: r.removed > 0 ? "A inscrição deste aparelho tinha expirado e foi removida. Ligue de novo." : "Não consegui entregar. Tente de novo em instantes." };
}
