"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings, patchSettings, AI_DAILY_LIMIT, type AiShare } from "@/lib/settings";
import { AiError, getProvider } from "@/lib/ai";
import { aiFailureText } from "@/lib/ai/messages";
import { aiUsageToday } from "@/lib/planner/service";
import { optInt, optMoneyCents, optText, reqInt } from "@/lib/schema-kit";
import type { FormState } from "@/lib/agenda/schemas";

const done = () => revalidatePath("/", "layout");
const strs = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

const FLAGS = ["aiEnabled", "retroNotice", "screenBreakReminder", "share.agenda", "share.mood", "share.diary", "share.expenses", "share.health"] as const;

/** Liga/desliga uma preferência (interruptores da tela de Configurações). */
export async function setFlag(name: string, value: boolean): Promise<void> {
  const u = await requireUser();
  if (!(FLAGS as readonly string[]).includes(name)) return;
  if (name.startsWith("share.")) {
    const s = await getSettings(u.id);
    const aiShare: AiShare = { ...s.aiShare, [name.slice(6)]: value };
    await patchSettings(u.id, { aiShare });
  } else {
    await patchSettings(u.id, { [name]: value } as never);
  }
  done();
}

export async function saveProfile(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ displayName: optText(40) }).safeParse(strs(f));
  if (!parsed.success) return { error: "Nome inválido." };
  await patchSettings(u.id, { displayName: parsed.data.displayName });
  done();
  return { ok: true };
}

export async function saveAccent(f: FormData) {
  const u = await requireUser();
  const accent = z.enum(["lotus", "sage", "sun", "lavender"]).safeParse(f.get("accent"));
  if (accent.success) await patchSettings(u.id, { accent: accent.data });
  done();
}

export async function saveGoals(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ waterGoal: reqInt(1, 40), sessions: reqInt(1, 21), books: reqInt(1, 365), budget: optMoneyCents(), cooldown: reqInt(1, 120) }).safeParse(strs(f));
  if (!parsed.success) return { error: "Confira os números informados.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  const d = parsed.data;
  await patchSettings(u.id, { waterGoal: d.waterGoal, readingSessionsPerWeek: d.sessions, readingBooksPerYear: d.books, monthlyBudgetCents: d.budget && d.budget > 0 ? d.budget : null, aiCooldownMin: d.cooldown });
  done();
  return { ok: true };
}

export async function clearAiLog() {
  const u = await requireUser();
  await query("DELETE FROM ai_requests WHERE user_id = $1 AND created_at < now() - interval '1 day'", [u.id]);
  done();
}
void optInt;

/**
 * "Testar IA agora": faz uma chamada mínima ao Gemini (ignora a espera após falha) e mostra o resultado exato.
 * Conta no limite diário. Se der certo, a IA volta a ficar disponível na hora.
 */
export async function testAi(): Promise<{ ok: boolean; message: string }> {
  const u = await requireUser();
  const provider = getProvider();
  if (!provider) return { ok: false, message: aiFailureText("no_key") + " Confira o nome da variável, se ela vale para Production e se houve um novo deploy depois de salvá-la." };
  if ((await aiUsageToday(u.id)) >= AI_DAILY_LIMIT) return { ok: false, message: `O limite de ${AI_DAILY_LIMIT} chamadas de hoje já foi usado.` };
  try {
    const text = await provider.generate({ system: "Responda apenas com a palavra: ok", prompt: "Teste de conexão." });
    await query("INSERT INTO ai_requests (user_id, kind, outcome, provider_called) VALUES ($1,'test','ai',true)", [u.id]);
    done();
    return { ok: true, message: `Funcionou. O Gemini (${provider.name.replace("gemini:", "")}) respondeu: "${text.trim().slice(0, 40)}".` };
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("http", e instanceof Error ? e.message : undefined);
    await query("INSERT INTO ai_requests (user_id, kind, outcome, reason, provider_called, response) VALUES ($1,'test','failed',$2,true,$3::jsonb)", [u.id, err.reason, JSON.stringify({ detail: err.detail ?? null })]);
    done();
    return { ok: false, message: aiFailureText(err.reason, err.detail) };
  }
}
