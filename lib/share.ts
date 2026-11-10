import { query, queryOne } from "@/lib/db";
import { fetchLinkMeta } from "@/lib/safe-fetch";

export type ShareDest = "ler" | "ideia" | "receita" | "desejo";
export const SHARE_DESTS: { key: ShareDest; label: string; needsUrl: boolean; href: string }[] = [
  { key: "ler", label: "Ler depois", needsUrl: true, href: "/leituras?t=artigos" },
  { key: "ideia", label: "Ideia", needsUrl: false, href: "/ideias" },
  { key: "receita", label: "Receita", needsUrl: true, href: "/receitas" },
  { key: "desejo", label: "Desejo", needsUrl: true, href: "/desejos" },
];

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** O Android manda título, texto e link; muitos apps colocam o link dentro do texto. Devolve o primeiro endereço http(s) válido. */
export function parseShared(p: { title?: string | null; text?: string | null; url?: string | null }): { url: string | null; title: string | null; text: string | null } {
  const clean = (s: string | null | undefined) => (s ?? "").trim();
  const candidates = [clean(p.url), clean(p.text), clean(p.title)];
  let url: string | null = null;
  for (const c of candidates) {
    const m = c.match(URL_RE);
    if (m) { const u = m[0].replace(/[.,;:!?)\]]+$/, ""); try { const parsed = new URL(u); if (/^https?:$/.test(parsed.protocol)) { url = parsed.toString().slice(0, 1000); break; } } catch { /* tenta o próximo */ } }
  }
  const strip = (s: string) => clean(s.replace(URL_RE, "")).replace(/\s+/g, " ");
  const title = strip(clean(p.title)) || null;
  const text = strip(clean(p.text)) || null;
  return { url, title: title ? title.slice(0, 200) : null, text: text ? text.slice(0, 400) : null };
}

const hostTitle = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Link"; } };

/** Cria o item no módulo escolhido. Busca título e capa do link com as proteções de busca externa. */
export async function saveShared(userId: string, dest: ShareDest, shared: { url: string | null; title: string | null; text: string | null }): Promise<{ ok: true; label: string; duplicate?: boolean } | { ok: false; error: string }> {
  const { url } = shared;
  const needsUrl = SHARE_DESTS.find((d) => d.key === dest)?.needsUrl;
  if (needsUrl && !url) return { ok: false, error: "Esse conteúdo não tem um link. Guarde como Ideia." };

  if (dest === "ideia") {
    const body = [shared.title, shared.text, url].filter(Boolean).join(" · ").slice(0, 500);
    if (!body) return { ok: false, error: "Nada para guardar." };
    await query("INSERT INTO ideas (user_id, text) VALUES ($1,$2)", [userId, body]);
    return { ok: true, label: "Ideia" };
  }
  const meta = await fetchLinkMeta(url!);
  const title = (meta.title || shared.title || hostTitle(url!)).slice(0, 200);
  const image = meta.image;
  if (dest === "ler") {
    if (await queryOne("SELECT 1 FROM reading_items WHERE user_id = $1 AND kind = 'artigo' AND url = $2", [userId, url])) return { ok: true, label: "Ler depois", duplicate: true };
    await query("INSERT INTO reading_items (user_id, kind, title, url, cover_url, status) VALUES ($1,'artigo',$2,$3,$4,'quero')", [userId, title, url, image]);
    return { ok: true, label: "Ler depois" };
  }
  if (dest === "receita") {
    if (await queryOne("SELECT 1 FROM recipes WHERE user_id = $1 AND source_url = $2", [userId, url])) return { ok: true, label: "Receita", duplicate: true };
    await query("INSERT INTO recipes (user_id, title, source_url, photo_url) VALUES ($1,$2,$3,$4)", [userId, title, url, image]);
    return { ok: true, label: "Receita" };
  }
  if (await queryOne("SELECT 1 FROM wishlist_items WHERE user_id = $1 AND url = $2", [userId, url])) return { ok: true, label: "Desejo", duplicate: true };
  await query("INSERT INTO wishlist_items (user_id, name, url, photo_url) VALUES ($1,$2,$3,$4)", [userId, title, url, image]);
  return { ok: true, label: "Desejo" };
}
