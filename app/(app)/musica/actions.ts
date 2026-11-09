"use server";

import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord, saveRecord, type CrudDef } from "@/lib/crud";
import { bool, id, oneOf, optNum, optOneOf, optText, text, url } from "@/lib/schema-kit";
import type { FormState } from "@/lib/agenda/schemas";

const audio: CrudDef = {
  table: "audio_items",
  schema: z.object({ id, kind: oneOf(["album", "artista", "musica", "podcast"]), title: text(160), creator: optText(120), status: oneOf(["quero", "ouvido"]), rating: optNum(0, 5), comment: optText(500), cover_url: url(), link: url(), progress: optText(80) }),
};
const playlist: CrudDef = {
  table: "playlists",
  schema: z.object({ id, title: text(120), subtitle: optText(160), url: url(), cover_url: url(), mood: optOneOf(["calmo", "animado", "focado", "nostalgico"]), is_today: bool }),
};

export async function saveAudio(_p: FormState, f: FormData) { const u = await requireUser(); return saveRecord(audio, f, u.id); }
export async function deleteAudio(f: FormData) { const u = await requireUser(); await removeRecord("audio_items", f.get("id"), u.id); }
export async function savePlaylist(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  // só uma playlist é a "trilha do dia" por vez
  if (f.get("is_today") === "on") await query("UPDATE playlists SET is_today = false WHERE user_id = $1", [u.id]);
  return saveRecord(playlist, f, u.id);
}
export async function deletePlaylist(f: FormData) { const u = await requireUser(); await removeRecord("playlists", f.get("id"), u.id); }
