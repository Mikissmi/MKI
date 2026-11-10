import { loadKey } from "./crypto";
import type { SpotifyFeatures } from "@/lib/settings";

export type SpotifyConfig = {
  configured: boolean;
  /** nomes das variáveis de ambiente que faltam */
  missing: string[];
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authBase: string;
  apiBase: string;
};

export const STATE_COOKIE = "mki_spotify_state";
const PROD_AUTH = "https://accounts.spotify.com";
const PROD_API = "https://api.spotify.com";

/**
 * Só para testes locais: aponta o Spotify para um servidor falso quando o banco é local.
 * Em produção (Neon) as bases são sempre as oficiais.
 */
function devOverridesAllowed(): boolean {
  if (process.env.MKI_DEV_ALLOW_LOOPBACK !== "1") return false;
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "").hostname); } catch { return false; }
}

export function spotifyConfig(env: NodeJS.ProcessEnv = process.env): SpotifyConfig {
  const clientId = env.SPOTIFY_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.SPOTIFY_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = env.SPOTIFY_REDIRECT_URI?.trim() ?? "";
  const missing: string[] = [];
  if (!clientId) missing.push("SPOTIFY_CLIENT_ID");
  if (!clientSecret) missing.push("SPOTIFY_CLIENT_SECRET");
  if (!redirectUri) missing.push("SPOTIFY_REDIRECT_URI");
  if (!loadKey(env.SPOTIFY_TOKEN_KEY)) missing.push("SPOTIFY_TOKEN_KEY");
  const dev = devOverridesAllowed();
  return {
    configured: missing.length === 0, missing, clientId, clientSecret, redirectUri,
    authBase: dev && env.SPOTIFY_AUTH_BASE ? env.SPOTIFY_AUTH_BASE : PROD_AUTH,
    apiBase: dev && env.SPOTIFY_API_BASE ? env.SPOTIFY_API_BASE : PROD_API,
  };
}

/** O Spotify só aceita HTTPS, ou http://127.0.0.1 (loopback); "localhost" é proibido. Devolve o problema, se houver. */
export function redirectUriProblem(uri: string): string | null {
  let u: URL;
  try { u = new URL(uri); } catch { return "SPOTIFY_REDIRECT_URI não é um endereço válido."; }
  if (u.hostname === "localhost") return 'O Spotify não aceita "localhost": use http://127.0.0.1:PORTA/api/spotify/callback para testes locais.';
  const loopback = u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && loopback)) return "O endereço de retorno precisa ser HTTPS (ou http://127.0.0.1 para testes locais).";
  if (u.pathname !== "/api/spotify/callback") return "O endereço de retorno precisa terminar em /api/spotify/callback.";
  return null;
}

/** Só pede ao Spotify as permissões dos recursos que estão ligados. */
export function scopesFor(f: SpotifyFeatures): string[] {
  const s: string[] = [];
  if (f.playlists) s.push("playlist-read-private", "playlist-read-collaborative");
  if (f.history) s.push("user-read-recently-played");
  return s;
}

/** Permissões que os recursos ligados exigem e que a conta conectada ainda não concedeu. */
export const missingScopes = (f: SpotifyFeatures, granted: string[]): string[] => scopesFor(f).filter((s) => !granted.includes(s));
