/**
 * Normalização das respostas do Spotify para o que o app usa.
 * Em 2026 o Spotify removeu campos (publisher, popularity, product...): tudo aqui tolera campos ausentes ou nulos.
 */
type Img = { url?: string | null; width?: number | null };
type Obj = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Obj[]) : []);
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

/** Menor imagem com pelo menos ~160 px (ou a primeira): economiza banda nas capas. */
export function pickImage(images: unknown): string | null {
  const list = arr(images) as Img[];
  const usable = list.filter((i) => str(i.url));
  if (usable.length === 0) return null;
  const big = usable.filter((i) => (i.width ?? 9999) >= 160).sort((a, b) => (a.width ?? 9999) - (b.width ?? 9999));
  return str((big[0] ?? usable[0]).url);
}

const httpsOnly = (u: string | null) => (u && /^https:\/\//i.test(u) ? u : null);
export const spotifyUrl = (o: Obj) => httpsOnly(str(obj(o.external_urls).spotify));

export type SpPlaylist = { id: string; name: string; cover: string | null; url: string | null; owner: string | null };
export type SpResult = { id: string; kind: "album" | "artist" | "podcast"; title: string; creator: string | null; cover: string | null; url: string | null };
export type SpPlay = { trackName: string; albumId: string | null; albumName: string | null; artistIds: string[]; artistNames: string[]; playedAt: string };

export function mapPlaylists(json: unknown): SpPlaylist[] {
  const out: SpPlaylist[] = [];
  for (const p of arr(obj(json).items)) {
    const id = str(p.id), name = str(p.name);
    if (!id || !name) continue; // a API às vezes devolve itens nulos
    out.push({ id, name, cover: httpsOnly(pickImage(p.images)), url: spotifyUrl(p), owner: str(obj(p.owner).display_name) });
  }
  return out;
}

export function mapSearch(json: unknown): SpResult[] {
  const j = obj(json);
  const out: SpResult[] = [];
  for (const a of arr(obj(j.albums).items)) {
    const id = str(a.id), title = str(a.name);
    if (id && title) out.push({ id, kind: "album", title, creator: arr(a.artists).map((x) => str(x.name)).filter(Boolean).join(", ") || null, cover: httpsOnly(pickImage(a.images)), url: spotifyUrl(a) });
  }
  for (const a of arr(obj(j.artists).items)) {
    const id = str(a.id), title = str(a.name);
    if (id && title) out.push({ id, kind: "artist", title, creator: null, cover: httpsOnly(pickImage(a.images)), url: spotifyUrl(a) });
  }
  // "publisher" foi removido dos podcasts em 2026: o criador fica vazio quando não vier
  for (const a of arr(obj(j.shows).items)) {
    const id = str(a.id), title = str(a.name);
    if (id && title) out.push({ id, kind: "podcast", title, creator: str(a.publisher), cover: httpsOnly(pickImage(a.images)), url: spotifyUrl(a) });
  }
  return out;
}

export function mapRecent(json: unknown): SpPlay[] {
  const out: SpPlay[] = [];
  for (const it of arr(obj(json).items)) {
    const t = obj(it.track), album = obj(t.album), playedAt = str(it.played_at);
    if (!playedAt || !Number.isFinite(new Date(playedAt).getTime())) continue;
    out.push({
      trackName: str(t.name) ?? "", albumId: str(album.id), albumName: str(album.name),
      artistIds: arr(t.artists).map((a) => str(a.id)).filter((x): x is string => Boolean(x)), artistNames: arr(t.artists).map((a) => str(a.name)).filter((x): x is string => Boolean(x)), playedAt,
    });
  }
  return out;
}

export type ListItem = { id: string; kind: string; spotify_id: string | null; status: string };

/**
 * Itens de "Para ouvir" que bateram com o histórico recente: álbum pelo id do álbum da faixa tocada, artista pelo id do artista.
 * Podcasts ficam de fora (o histórico do Spotify não traz episódios). Cada item usa a tocada mais recente.
 */
export function matchListened(items: ListItem[], plays: SpPlay[]): { id: string; playedAt: string }[] {
  const latest = new Map<string, string>();
  const note = (key: string, at: string) => { if (!latest.has(key) || at > latest.get(key)!) latest.set(key, at); };
  for (const p of plays) { if (p.albumId) note(p.albumId, p.playedAt); for (const a of p.artistIds) note(a, p.playedAt); }
  const out: { id: string; playedAt: string }[] = [];
  for (const i of items) {
    if (i.status !== "quero" || !i.spotify_id || (i.kind !== "album" && i.kind !== "artista")) continue;
    const at = latest.get(i.spotify_id);
    if (at) out.push({ id: i.id, playedAt: at });
  }
  return out;
}
