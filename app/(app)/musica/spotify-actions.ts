"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { cacheGet } from "@/lib/spotify/cache";
import { getPlaylists, searchSpotify, spotifyErrorText, syncListened } from "@/lib/spotify/service";
import type { SpPlaylist, SpResult } from "@/lib/spotify/normalize";
import { bool, optOneOf, optUuid } from "@/lib/schema-kit";
import type { FormState } from "@/lib/agenda/schemas";

const SPOTIFY_ID = /^[A-Za-z0-9]{8,40}$/;

/** "Atualizar": força a leitura das playlists e do histórico (respeita o limite diário e o bloqueio por 429). */
export async function refreshSpotify(): Promise<{ message: string; ok: boolean }> {
  const u = await requireUser();
  const pl = await getPlaylists(u.id, { force: true });
  const hist = await syncListened(u.id, { force: true });
  revalidatePath("/", "layout");
  const err = pl.error ?? hist.error;
  if (err) return { ok: false, message: spotifyErrorText(err) };
  return { ok: true, message: hist.marked ? `Atualizado. ${hist.marked} item(ns) marcados como ouvidos.` : "Atualizado." };
}

export type SearchOutcome = { results: SpResult[]; error: string | null; cached: boolean };

export async function searchAction(q: string): Promise<SearchOutcome> {
  const u = await requireUser();
  const r = await searchSpotify(u.id, String(q ?? "").slice(0, 120));
  return { results: r.data, error: r.error ? spotifyErrorText(r.error) : null, cached: r.fresh && r.updatedAt !== null && Date.now() - r.updatedAt.getTime() > 5_000 };
}

const KIND: Record<SpResult["kind"], string> = { album: "album", artist: "artista", podcast: "podcast" };

/** Adiciona um resultado da busca a "Para ouvir" (nome, capa e link). O dado vem do cache do servidor, não do navegador. */
export async function addFromSpotify(q: string, spotifyId: string): Promise<{ ok: boolean; message: string }> {
  const u = await requireUser();
  if (!SPOTIFY_ID.test(spotifyId)) return { ok: false, message: "Item inválido." };
  const cached = await cacheGet<SpResult[]>(u.id, `search:${String(q).trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80)}`);
  const item = cached?.content.find((r) => r.id === spotifyId);
  if (!item) return { ok: false, message: "Faça a busca de novo para adicionar." };
  const row = await queryOne<{ id: string }>(
    `INSERT INTO audio_items (user_id, kind, title, creator, status, cover_url, link, spotify_id, spotify_url)
     VALUES ($1,$2,$3,$4,'quero',$5,$6,$7,$6) ON CONFLICT (user_id, spotify_id) WHERE spotify_id IS NOT NULL DO NOTHING RETURNING id`,
    [u.id, KIND[item.kind], item.title.slice(0, 160), item.creator?.slice(0, 120) ?? null, item.cover, item.url, item.id]);
  revalidatePath("/", "layout");
  return row ? { ok: true, message: `"${item.title}" entrou em Para ouvir.` } : { ok: true, message: `"${item.title}" já estava na sua lista.` };
}

/** Usa uma das suas playlists do Spotify como trilha: por humor, por atividade ou como a "do dia". */
export async function useSpotifyPlaylist(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const parsed = z.object({ spotify_id: z.string().regex(SPOTIFY_ID), mood: optOneOf(["calmo", "animado", "focado", "nostalgico"]), activity_id: optUuid, is_today: bool }).safeParse(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: "Confira as opções escolhidas." };
  const d = parsed.data;
  const pl = (await cacheGet<SpPlaylist[]>(u.id, "playlists"))?.content.find((p) => p.id === d.spotify_id);
  if (!pl) return { error: "Atualize a lista de playlists e tente de novo." };
  if (d.activity_id && !(await queryOne("SELECT 1 FROM activities WHERE id = $1 AND user_id = $2", [d.activity_id, u.id]))) return { error: "Atividade não encontrada." };
  if (d.is_today) await query("UPDATE playlists SET is_today = false WHERE user_id = $1", [u.id]);
  await query(
    `INSERT INTO playlists (user_id, title, url, cover_url, mood, is_today, activity_id, spotify_playlist_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id, spotify_playlist_id) WHERE spotify_playlist_id IS NOT NULL
     DO UPDATE SET title = $2, url = $3, cover_url = $4, mood = $5, is_today = $6, activity_id = $7`,
    [u.id, pl.name.slice(0, 120), pl.url, pl.cover, d.mood, d.is_today, d.activity_id, pl.id]);
  revalidatePath("/", "layout");
  return { ok: true };
}

