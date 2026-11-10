import { query, queryOne } from "@/lib/db";
import { decryptToken, encryptToken } from "./crypto";
import { spotifyConfig } from "./config";
import { cacheDeleteAll } from "./cache";

export type SpotifyErrorKind = "not_configured" | "not_connected" | "reauth" | "forbidden" | "rate_limited" | "quota" | "daily_limit" | "http";

export class SpotifyError extends Error {
  constructor(public kind: SpotifyErrorKind, public detail?: string, public retryAfterSec?: number) { super(kind); }
}

const short = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 160) : undefined) || undefined;
const basic = () => { const c = spotifyConfig(); return "Basic " + Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64"); };

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };

async function tokenRequest(form: Record<string, string>): Promise<TokenResponse & { status: number }> {
  const cfg = spotifyConfig();
  const res = await fetch(`${cfg.authBase}/api/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", authorization: basic() },
    body: new URLSearchParams(form), signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) throw new SpotifyError("http", "não foi possível falar com o Spotify");
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  return { ...body, status: res.status };
}

export function authorizeUrl(state: string, scopes: string[], showDialog: boolean): string {
  const cfg = spotifyConfig();
  const p = new URLSearchParams({ response_type: "code", client_id: cfg.clientId, redirect_uri: cfg.redirectUri, state, show_dialog: String(showDialog) });
  if (scopes.length) p.set("scope", scopes.join(" "));
  return `${cfg.authBase}/authorize?${p}`;
}

/** Troca o código por tokens, descobre o perfil e guarda tudo criptografado. */
export async function connectAccount(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const cfg = spotifyConfig();
  const t = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: cfg.redirectUri }).catch(() => null);
  if (!t || t.status !== 200 || !t.access_token || !t.refresh_token) return { ok: false, error: "O Spotify não aceitou o código de autorização." };
  const me = await fetch(`${cfg.apiBase}/v1/me`, { headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const profile = me && me.ok ? ((await me.json().catch(() => ({}))) as { id?: string; account_id?: string; display_name?: string }) : null;
  if (!profile) return { ok: false, error: me && (me.status === 403) ? "O Spotify recusou o acesso (403). Confira se o e-mail da sua conta está na lista de usuários do app e se o Premium do dono está ativo." : "Não consegui ler o perfil do Spotify." };
  // account_id é o identificador estável (id pode mudar)
  const spotifyUserId = profile.account_id ?? profile.id ?? "";
  const scopes = (t.scope ?? "").split(/\s+/).filter(Boolean);
  await query(
    `INSERT INTO spotify_accounts (user_id, spotify_user_id, display_name, access_token_enc, refresh_token_enc, expires_at, scopes, needs_reconnect, last_error, connected_at)
     VALUES ($1,$2,$3,$4,$5, now() + ($6 || ' seconds')::interval, $7, false, NULL, now())
     ON CONFLICT (user_id) DO UPDATE SET spotify_user_id = $2, display_name = $3, access_token_enc = $4, refresh_token_enc = $5,
       expires_at = now() + ($6 || ' seconds')::interval, scopes = $7, needs_reconnect = false, last_error = NULL, connected_at = now()`,
    [userId, spotifyUserId, profile.display_name ?? null, encryptToken(t.access_token), encryptToken(t.refresh_token), String(t.expires_in ?? 3600), scopes]);
  return { ok: true };
}

type Account = { access_token_enc: string; refresh_token_enc: string; expires_at: Date | string; needs_reconnect: boolean; scopes: string[] };

export async function loadAccount(userId: string): Promise<Account | null> {
  return queryOne<Account>("SELECT access_token_enc, refresh_token_enc, expires_at, needs_reconnect, scopes FROM spotify_accounts WHERE user_id = $1", [userId]);
}

/** Token de acesso válido; renova com o refresh token quando faltar menos de 1 minuto. Falha de renovação = precisa reconectar. */
export async function accessToken(userId: string, acc: Account, force = false): Promise<string> {
  if (acc.needs_reconnect) throw new SpotifyError("reauth");
  const access = decryptToken(acc.access_token_enc);
  if (!force && access && new Date(acc.expires_at).getTime() - Date.now() > 60_000) return access;
  const refresh = decryptToken(acc.refresh_token_enc);
  if (!refresh) { await markReauth(userId, "não foi possível abrir os tokens guardados (chave mudou?)"); throw new SpotifyError("reauth"); }
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  if (t.status !== 200 || !t.access_token) {
    if (t.status === 400 || t.status === 401) { await markReauth(userId, "o Spotify recusou a renovação (a autorização expirou ou foi revogada)"); throw new SpotifyError("reauth"); }
    throw new SpotifyError("http", `renovação do token falhou (${t.status})`);
  }
  await query(
    `UPDATE spotify_accounts SET access_token_enc = $2, refresh_token_enc = COALESCE($3, refresh_token_enc), expires_at = now() + ($4 || ' seconds')::interval,
            scopes = CASE WHEN $5::text[] = '{}' THEN scopes ELSE $5::text[] END WHERE user_id = $1`,
    [userId, encryptToken(t.access_token), t.refresh_token ? encryptToken(t.refresh_token) : null, String(t.expires_in ?? 3600), (t.scope ?? "").split(/\s+/).filter(Boolean)]);
  return t.access_token;
}

async function markReauth(userId: string, why: string) {
  await query("UPDATE spotify_accounts SET needs_reconnect = true, last_error = $2 WHERE user_id = $1", [userId, why]);
}

/** Desconectar: apaga os tokens e os dados pessoais guardados em cache. Itens que você adicionou a "Para ouvir" continuam. */
export async function disconnectAccount(userId: string): Promise<void> {
  await query("DELETE FROM spotify_accounts WHERE user_id = $1", [userId]);
  await cacheDeleteAll(userId);
}

export const spotifyErrorDetail = short;
