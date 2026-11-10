"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings, patchSettings, AI_DAILY_LIMIT, type AiShare, type SpotifyFeatures } from "@/lib/settings";
import { authorizeUrl, disconnectAccount } from "@/lib/spotify/auth";
import { redirectUriProblem, scopesFor, spotifyConfig, STATE_COOKIE } from "@/lib/spotify/config";
import { AiError, getProvider } from "@/lib/ai";
import { aiFailureText } from "@/lib/ai/messages";
import { aiUsageToday } from "@/lib/planner/service";
import { optInt, optMoneyCents, optText, reqInt } from "@/lib/schema-kit";
import type { FormState } from "@/lib/agenda/schemas";

const done = () => revalidatePath("/", "layout");
const strs = (f: FormData) => Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;

const FLAGS = ["aiEnabled", "retroNotice", "screenBreakReminder", "share.agenda", "share.mood", "share.diary", "share.expenses", "share.health", "share.music", "spotify.playlists", "spotify.search", "spotify.history", "morningSummary", "memoryCard"] as const;

/** Liga/desliga uma preferência (interruptores da tela de Configurações). */
export async function setFlag(name: string, value: boolean): Promise<void> {
  const u = await requireUser();
  if (!(FLAGS as readonly string[]).includes(name)) return;
  if (name.startsWith("spotify.")) {
    const s = await getSettings(u.id);
    const spotifyFeatures: SpotifyFeatures = { ...s.spotifyFeatures, [name.slice(8)]: value };
    await patchSettings(u.id, { spotifyFeatures });
  } else if (name.startsWith("share.")) {
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

/** Limites do Spotify: intervalo mínimo entre atualizações e máximo de chamadas por dia. */
export async function saveSpotifyLimits(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ interval: reqInt(5, 1440), daily: reqInt(5, 1000) }).safeParse(strs(f));
  if (!parsed.success) return { error: "Confira os números informados.", fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])) };
  await patchSettings(u.id, { spotifyMinIntervalMin: parsed.data.interval, spotifyDailyLimit: parsed.data.daily });
  done();
  return { ok: true };
}

/** Começa o login no Spotify: guarda um `state` aleatório num cookie e segue para a tela de autorização do Spotify. */
export async function connectSpotify(f: FormData) {
  const u = await requireUser();
  const cfg = spotifyConfig();
  if (!cfg.configured) redirect("/configuracoes?spotify=not_configured");
  const problem = redirectUriProblem(cfg.redirectUri);
  if (problem) redirect(`/configuracoes?spotify=error&msg=${encodeURIComponent(problem)}`);
  const s = await getSettings(u.id);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/spotify", maxAge: 600 });
  redirect(authorizeUrl(state, scopesFor(s.spotifyFeatures), f.get("reconnect") === "1"));
}

/** Desconectar: apaga os tokens e o cache do Spotify. */
export async function disconnectSpotify() {
  const u = await requireUser();
  await disconnectAccount(u.id);
  done();
  redirect("/configuracoes?spotify=disconnected");
}

export async function saveWelcome(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ days: reqInt(1, 30) }).safeParse(strs(f));
  if (!parsed.success) return { error: "Informe de 1 a 30 dias.", fieldErrors: { days: "Informe de 1 a 30 dias." } };
  await patchSettings(u.id, { welcomeAfterDays: parsed.data.days });
  done();
  return { ok: true };
}
