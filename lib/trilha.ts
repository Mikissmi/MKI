import { query } from "@/lib/db";
import { fetchCheckin } from "@/lib/agenda/queries";

export type TrilhaPlaylist = { id: string; title: string; subtitle: string | null; url: string | null; cover_url: string | null; mood: string | null; is_today: boolean; activity_id: string | null; spotify_playlist_id: string | null };

export const moodKeyFor = (mood: number | null | undefined): "calmo" | "animado" | null => (mood == null ? null : mood <= 2 ? "calmo" : mood >= 4 ? "animado" : null);

/**
 * Trilha do dia: a marcada como "do dia"; senão uma ligada a uma atividade que está no plano de hoje;
 * senão uma que combine com o humor de hoje. Em `fallback` (tela de Música) cai para a mais recente.
 */
export function pickTrilha(playlists: TrilhaPlaylist[], opts: { moodKey: string | null; activityIds: string[]; fallback?: boolean }): TrilhaPlaylist | undefined {
  return playlists.find((p) => p.is_today)
    ?? playlists.find((p) => p.activity_id && opts.activityIds.includes(p.activity_id))
    ?? playlists.find((p) => opts.moodKey && p.mood === opts.moodKey)
    ?? (opts.fallback ? playlists[0] : undefined);
}

export async function loadTrilha(userId: string, date: string, fallback = false): Promise<{ trilha: TrilhaPlaylist | undefined; playlists: TrilhaPlaylist[] }> {
  const [playlists, checkin, blocks] = await Promise.all([
    query<TrilhaPlaylist>("SELECT id, title, subtitle, url, cover_url, mood, is_today, activity_id, spotify_playlist_id FROM playlists WHERE user_id = $1 ORDER BY is_today DESC, created_at DESC", [userId]),
    fetchCheckin(userId, date),
    query<{ ref_id: string }>("SELECT ref_id FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND ref_type = 'activity' AND ref_id IS NOT NULL AND status IN ('proposed','accepted')", [userId, date]),
  ]);
  return { playlists, trilha: pickTrilha(playlists, { moodKey: moodKeyFor(checkin?.mood), activityIds: blocks.map((b) => b.ref_id), fallback }) };
}
