import { query, queryOne } from "@/lib/db";
import { getSettings, type SpotifyFeatures } from "@/lib/settings";
import { localDateKey } from "@/lib/time";
import { SpotifyError, loadAccount } from "./auth";
import { spotifyGet } from "./api";
import { cacheGet, cachePurge, cacheSet, callsToday } from "./cache";
import { spotifyConfig, missingScopes } from "./config";
import { mapPlaylists, mapRecent, mapSearch, matchListened, type SpPlaylist, type SpResult } from "./normalize";

export type SpotifyStatus = {
  configured: boolean;
  missingEnv: string[];
  connected: boolean;
  needsReconnect: boolean;
  displayName: string | null;
  lastError: string | null;
  /** recursos ligados cuja permissão a conta ainda não concedeu: precisa reconectar para liberar */
  missingScopes: string[];
  blockedUntil: number | null;
  callsToday: number;
};

export async function spotifyStatus(userId: string, features: SpotifyFeatures): Promise<SpotifyStatus> {
  const cfg = spotifyConfig();
  const acc = await queryOne<{ display_name: string | null; needs_reconnect: boolean; last_error: string | null; scopes: string[] }>(
    "SELECT display_name, needs_reconnect, last_error, scopes FROM spotify_accounts WHERE user_id = $1", [userId]);
  const st = acc ? await cacheGet<{ blockedUntil?: number }>(userId, "status") : null;
  return {
    configured: cfg.configured, missingEnv: cfg.missing, connected: Boolean(acc), needsReconnect: Boolean(acc?.needs_reconnect),
    displayName: acc?.display_name ?? null, lastError: acc?.last_error ?? null,
    missingScopes: acc ? missingScopes(features, acc.scopes) : [],
    blockedUntil: st?.content.blockedUntil && st.content.blockedUntil > Date.now() ? st.content.blockedUntil : null,
    callsToday: acc ? await callsToday(userId, localDateKey()) : 0,
  };
}

/** Texto em português para cada tipo de erro. Nada aqui contém tokens. */
export function spotifyErrorText(e: unknown): string {
  if (!(e instanceof SpotifyError)) return "Não consegui falar com o Spotify agora.";
  switch (e.kind) {
    case "not_configured": return "O Spotify ainda não foi configurado no servidor.";
    case "not_connected": return "Conecte sua conta do Spotify em Configurações.";
    case "reauth": return "A conexão com o Spotify expirou. Reconecte para continuar.";
    case "forbidden": return `O Spotify recusou o acesso${e.detail ? ` (${e.detail})` : ""}. Confira se o Premium está ativo e se seu e-mail está na lista de usuários do app.`;
    case "rate_limited": return `O Spotify pediu para esperar${e.retryAfterSec ? ` cerca de ${Math.max(1, Math.ceil(e.retryAfterSec / 60))} min` : " um pouco"}. Mostrando o que já estava guardado.`;
    case "quota": return "O limite de uso do app no Spotify foi atingido. Mostrando o que já estava guardado.";
    case "daily_limit": return "O limite diário de chamadas ao Spotify que você definiu foi atingido. Mostrando o que já estava guardado.";
    default: return `O Spotify não respondeu direito${e.detail ? ` (${e.detail})` : ""}. Mostrando o que já estava guardado.`;
  }
}

export type Loaded<T> = { data: T; fresh: boolean; updatedAt: Date | null; error: SpotifyError | null };

const hasAccount = async (userId: string) => Boolean(await loadAccount(userId));

/**
 * Playlists próprias. Só vai ao Spotify se o cache passou do intervalo mínimo configurado (e só quando a tela de Música é aberta).
 * Em qualquer falha devolve o que estava guardado, com o erro ao lado: nada bloqueia o app.
 */
export async function getPlaylists(userId: string, opts: { force?: boolean } = {}): Promise<Loaded<SpPlaylist[]>> {
  const s = await getSettings(userId);
  const cached = await cacheGet<SpPlaylist[]>(userId, "playlists");
  const data = cached?.content ?? [];
  if (!s.spotifyFeatures.playlists || !(await hasAccount(userId))) return { data, fresh: false, updatedAt: cached?.updatedAt ?? null, error: null };
  const age = cached ? Date.now() - cached.updatedAt.getTime() : Infinity;
  if (cached && !opts.force && age < s.spotifyMinIntervalMin * 60_000) return { data, fresh: true, updatedAt: cached.updatedAt, error: null };
  if (cached && opts.force && age < 30_000) return { data, fresh: true, updatedAt: cached.updatedAt, error: null }; // evita cliques repetidos
  try {
    await cachePurge(userId);
    const all: SpPlaylist[] = [];
    for (let offset = 0; offset < 100; offset += 50) {
      const page = mapPlaylists(await spotifyGet(userId, "/me/playlists", { limit: 50, offset }));
      all.push(...page);
      if (page.length < 50) break;
    }
    await cacheSet(userId, "playlists", all);
    // mantém nome/capa das playlists já usadas como trilha do dia
    for (const p of all) await query("UPDATE playlists SET title = $3, cover_url = COALESCE($4, cover_url), url = COALESCE($5, url) WHERE user_id = $1 AND spotify_playlist_id = $2", [userId, p.id, p.name, p.cover, p.url]);
    return { data: all, fresh: true, updatedAt: new Date(), error: null };
  } catch (e) {
    if (e instanceof SpotifyError) return { data, fresh: false, updatedAt: cached?.updatedAt ?? null, error: e };
    throw e;
  }
}

const normQuery = (q: string) => q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);

/** Busca de álbum/artista/podcast. O limite de resultados do Spotify hoje é 10. Mesma busca em 24 h usa o cache. */
export async function searchSpotify(userId: string, q: string): Promise<Loaded<SpResult[]>> {
  const term = normQuery(q);
  if (term.length < 2) return { data: [], fresh: false, updatedAt: null, error: null };
  const key = `search:${term}`;
  const cached = await cacheGet<SpResult[]>(userId, key);
  if (cached && Date.now() - cached.updatedAt.getTime() < 86_400_000) return { data: cached.content, fresh: true, updatedAt: cached.updatedAt, error: null };
  const s = await getSettings(userId);
  if (!s.spotifyFeatures.search) return { data: [], fresh: false, updatedAt: null, error: null };
  try {
    const res = mapSearch(await spotifyGet(userId, "/search", { q: term, type: "album,artist,show", limit: 10, market: "from_token" }));
    await cacheSet(userId, key, res);
    return { data: res, fresh: true, updatedAt: new Date(), error: null };
  } catch (e) {
    if (e instanceof SpotifyError) return { data: cached?.content ?? [], fresh: false, updatedAt: cached?.updatedAt ?? null, error: e };
    throw e;
  }
}

/**
 * Lê o histórico recente (a API só devolve as últimas faixas) e marca como "ouvido" álbuns e artistas de "Para ouvir" que apareceram.
 * O histórico em si não é guardado: só a data em que o item foi ouvido.
 */
export async function syncListened(userId: string, opts: { force?: boolean } = {}): Promise<{ marked: number; error: SpotifyError | null }> {
  const s = await getSettings(userId);
  if (!s.spotifyFeatures.history || !(await hasAccount(userId))) return { marked: 0, error: null };
  const last = await cacheGet<{ at: string }>(userId, "recent_sync");
  if (last && Date.now() - new Date(last.content.at).getTime() < (opts.force ? 30_000 : s.spotifyMinIntervalMin * 60_000)) return { marked: 0, error: null };
  try {
    const plays = mapRecent(await spotifyGet(userId, "/me/player/recently-played", { limit: 50 }));
    const items = await query<{ id: string; kind: string; spotify_id: string | null; status: string }>("SELECT id, kind, spotify_id, status FROM audio_items WHERE user_id = $1 AND spotify_id IS NOT NULL AND status = 'quero'", [userId]);
    const hits = matchListened(items, plays);
    for (const h of hits) await query("UPDATE audio_items SET status = 'ouvido', listened_on = $3::date WHERE id = $1 AND user_id = $2", [h.id, userId, localDateKey(new Date(h.playedAt))]);
    await cacheSet(userId, "recent_sync", { at: new Date().toISOString(), marked: hits.length });
    return { marked: hits.length, error: null };
  } catch (e) {
    if (e instanceof SpotifyError) return { marked: 0, error: e };
    throw e;
  }
}
