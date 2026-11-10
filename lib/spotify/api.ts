import { getSettings } from "@/lib/settings";
import { localDateKey } from "@/lib/time";
import { accessToken, loadAccount, SpotifyError, spotifyErrorDetail } from "./auth";
import { cacheGet, cacheSet, callsToday, countCall } from "./cache";
import { spotifyConfig } from "./config";

type Status = { blockedUntil?: number; reason?: string };

/**
 * GET autenticado na Web API. Respeita o limite diário do app, o bloqueio depois de um 429 (Retry-After),
 * renova o token sozinho e nunca coloca tokens ou cabeçalhos em mensagens de erro.
 */
export async function spotifyGet(userId: string, path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  const cfg = spotifyConfig();
  if (!cfg.configured) throw new SpotifyError("not_configured");
  const acc = await loadAccount(userId);
  if (!acc) throw new SpotifyError("not_connected");
  if (acc.needs_reconnect) throw new SpotifyError("reauth");

  const st = await cacheGet<Status>(userId, "status");
  if (st?.content.blockedUntil && st.content.blockedUntil > Date.now()) throw new SpotifyError(st.content.reason === "QUOTA_EXCEEDED" ? "quota" : "rate_limited", undefined, Math.ceil((st.content.blockedUntil - Date.now()) / 1000));

  const settings = await getSettings(userId);
  const day = localDateKey();
  if ((await callsToday(userId, day)) >= settings.spotifyDailyLimit) throw new SpotifyError("daily_limit");

  const url = `${cfg.apiBase}/v1${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  let token = await accessToken(userId, acc);
  for (let attempt = 0; attempt < 2; attempt++) {
    await countCall(userId, day);
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!res) throw new SpotifyError("http", "não foi possível falar com o Spotify");
    if (res.ok) return res.json();
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; reason?: string } } | null;
    if (res.status === 401 && attempt === 0) { token = await accessToken(userId, acc, true); continue; } // token revogado/expirado: renova e tenta de novo
    if (res.status === 401) throw new SpotifyError("reauth");
    if (res.status === 403) throw new SpotifyError("forbidden", spotifyErrorDetail(body?.error?.message));
    if (res.status === 429) {
      const retry = Math.max(1, Math.min(Number(res.headers.get("retry-after")) || 60, 86_400));
      const quota = body?.error?.reason === "QUOTA_EXCEEDED";
      await cacheSet(userId, "status", { blockedUntil: Date.now() + retry * 1000, reason: quota ? "QUOTA_EXCEEDED" : "RATE_LIMIT" } satisfies Status);
      throw new SpotifyError(quota ? "quota" : "rate_limited", undefined, retry);
    }
    throw new SpotifyError("http", spotifyErrorDetail(body?.error?.message) ?? `HTTP ${res.status}`);
  }
  throw new SpotifyError("reauth");
}
