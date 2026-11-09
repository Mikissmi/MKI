import { XMLParser } from "fast-xml-parser";

export type ParsedItem = { guid: string; title: string; link: string; summary: string | null; imageUrl: string | null; publishedAt: Date | null };
export type ParsedFeed = { title: string; siteUrl: string | null; items: ParsedItem[] };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", processEntities: true, trimValues: true });

const arr = <T>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const str = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") return str((v as Record<string, unknown>)["#text"]);
  return String(v);
};

/** Só links http(s): bloqueia javascript:, data: etc. */
export const safeHttpUrl = (v: unknown, base?: string): string | null => {
  const s = str(v).trim();
  if (!s) return null;
  try { const u = new URL(s, base); return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null; } catch { return null; }
};

const ACCENTS: Record<string, string> = {};
for (const [base, accents] of Object.entries({ a: "áàâãä", e: "éèêë", i: "íìîï", o: "óòôõö", u: "úùûü", c: "ç", n: "ñ" })) {
  const names = ["acute", "grave", "circ", "tilde", "uml"];
  [...accents].forEach((ch, i) => { const n = base === "c" ? "cedil" : base === "n" ? "tilde" : names[i]; ACCENTS[base + n] = ch; ACCENTS[base.toUpperCase() + n] = ch.toUpperCase(); });
}
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ordf: "ª", ordm: "º", ...ACCENTS };

/** HTML do feed -> texto puro (sem tags, scripts ou estilos). O app nunca renderiza HTML de terceiros. */
export function toPlainText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m).replace(/\s+/g, " ").trim();
}

const firstImg = (html: string, base?: string) => { const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html); return m ? safeHttpUrl(m[1], base) : null; };

function imageOf(item: Record<string, unknown>, html: string, base?: string): string | null {
  for (const key of ["media:content", "media:thumbnail"]) {
    for (const m of arr(item[key] as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
      const u = safeHttpUrl(m?.["@_url"], base); const type = str(m?.["@_type"]); const medium = str(m?.["@_medium"]);
      if (u && (!type || type.startsWith("image") || medium === "image" || key === "media:thumbnail")) return u;
    }
  }
  for (const e of arr(item.enclosure as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
    if (str(e?.["@_type"]).startsWith("image")) { const u = safeHttpUrl(e["@_url"], base); if (u) return u; }
  }
  return firstImg(html, base);
}

const toDate = (v: unknown): Date | null => { const s = str(v); if (!s) return null; const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

/** Lê RSS 2.0, RSS 1.0 (RDF) ou Atom. Itens sem título ou sem link http(s) são descartados. */
export function parseFeed(xml: string, feedUrl?: string): ParsedFeed {
  let doc: Record<string, any>;
  try { doc = parser.parse(xml); } catch { throw new Error("Não é um feed válido"); }

  const items: ParsedItem[] = [];
  let title = "", siteUrl: string | null = null;

  if (doc.rss?.channel || doc["rdf:RDF"]) {
    const ch = doc.rss?.channel ?? doc["rdf:RDF"].channel ?? {};
    title = toPlainText(str(ch.title));
    siteUrl = safeHttpUrl(ch.link, feedUrl);
    for (const it of arr(doc.rss?.channel?.item ?? doc["rdf:RDF"]?.item)) {
      const link = safeHttpUrl(it.link, feedUrl) ?? safeHttpUrl(typeof it.guid === "object" && it.guid?.["@_isPermaLink"] !== "false" ? it.guid : null, feedUrl);
      const t = toPlainText(str(it.title));
      if (!link || !t) continue;
      const html = str(it["content:encoded"]) || str(it.description);
      items.push({ guid: (str(it.guid) || link).slice(0, 500), title: t.slice(0, 300), link, summary: toPlainText(str(it.description) || html).slice(0, 320) || null, imageUrl: imageOf(it, html, feedUrl), publishedAt: toDate(it.pubDate ?? it["dc:date"]) });
    }
  } else if (doc.feed) {
    title = toPlainText(str(doc.feed.title));
    const links = arr(doc.feed.link as Record<string, unknown> | Record<string, unknown>[]);
    siteUrl = safeHttpUrl((links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0])?.["@_href"], feedUrl);
    for (const en of arr(doc.feed.entry)) {
      const ls = arr(en.link as Record<string, unknown> | Record<string, unknown>[]);
      const link = safeHttpUrl((ls.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? ls[0])?.["@_href"], feedUrl);
      const t = toPlainText(str(en.title));
      if (!link || !t) continue;
      const html = str(en.content) || str(en.summary);
      items.push({ guid: (str(en.id) || link).slice(0, 500), title: t.slice(0, 300), link, summary: toPlainText(str(en.summary) || html).slice(0, 320) || null, imageUrl: imageOf(en, html, feedUrl), publishedAt: toDate(en.published ?? en.updated) });
    }
  } else {
    throw new Error("Não é um feed RSS ou Atom");
  }
  return { title: title.slice(0, 160) || (feedUrl ? new URL(feedUrl).hostname : "Feed"), siteUrl, items };
}

/** Em uma página HTML, acha o endereço do feed anunciado em <link rel="alternate">. */
export function discoverFeedUrl(html: string, base: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/rel=["']alternate["']/i.test(tag) && /type=["']application\/(rss|atom)\+xml["']/i.test(tag)) {
      const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
      const u = href ? safeHttpUrl(href, base) : null;
      if (u) return u;
    }
  }
  return null;
}

/** Tema do item: o do feed, ou o primeiro cujo termo aparece no título/resumo. */
export function matchTopic(text: string, topics: { id: string; keywords: string[] }[]): string | null {
  const t = text.toLowerCase();
  return topics.find((tp) => tp.keywords.some((k) => k && t.includes(k.toLowerCase())))?.id ?? null;
}
