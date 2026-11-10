import { query, queryOne } from "@/lib/db";

/** Cache temporário no banco (playlists, buscas, histórico recente, contadores). Dados do Spotify nunca ficam guardados para sempre. */
export const CACHE_MAX_AGE_MS = 7 * 86_400_000;

export async function cacheGet<T>(userId: string, key: string): Promise<{ content: T; updatedAt: Date } | null> {
  const row = await queryOne<{ content: T; updated_at: Date | string }>("SELECT content, updated_at FROM spotify_cache WHERE user_id = $1 AND key = $2", [userId, key]);
  return row ? { content: row.content, updatedAt: new Date(row.updated_at) } : null;
}

export async function cacheSet(userId: string, key: string, content: unknown): Promise<void> {
  await query(
    `INSERT INTO spotify_cache (user_id, key, content) VALUES ($1,$2,$3::jsonb)
     ON CONFLICT (user_id, key) DO UPDATE SET content = $3::jsonb, updated_at = now()`, [userId, key, JSON.stringify(content)]);
}

/** Conta uma chamada ao Spotify no dia e devolve o total do dia. */
export async function countCall(userId: string, dayKey: string): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `INSERT INTO spotify_cache (user_id, key, content) VALUES ($1,$2,'{"n":1}'::jsonb)
     ON CONFLICT (user_id, key) DO UPDATE SET content = jsonb_build_object('n', COALESCE((spotify_cache.content->>'n')::int, 0) + 1), updated_at = now()
     RETURNING (content->>'n')::int AS n`, [userId, `calls:${dayKey}`]);
  return row?.n ?? 1;
}

export async function callsToday(userId: string, dayKey: string): Promise<number> {
  const row = await cacheGet<{ n?: number }>(userId, `calls:${dayKey}`);
  return Number(row?.content?.n ?? 0);
}

/** "Apagar dados mais antigos": remove o que passou de 7 dias. */
export async function cachePurge(userId: string): Promise<void> {
  await query("DELETE FROM spotify_cache WHERE user_id = $1 AND updated_at < now() - ($2 || ' milliseconds')::interval", [userId, String(CACHE_MAX_AGE_MS)]);
}

export async function cacheDeleteAll(userId: string): Promise<void> {
  await query("DELETE FROM spotify_cache WHERE user_id = $1", [userId]);
}
