import { query, queryOne } from "@/lib/db";
import { safeFetchText, UnsafeUrlError } from "@/lib/safe-fetch";
import { discoverFeedUrl, matchTopic, parseFeed, type ParsedFeed } from "@/lib/rss";

/** Intervalo mínimo entre atualizações do mesmo feed (não há tarefa agendada: atualiza ao abrir a tela). */
export const MIN_REFRESH_MS = 30 * 60_000;
const KEEP_PER_FEED = 80;

export const SUGGESTED_FEEDS = [
  { title: "Tecnoblog", url: "https://tecnoblog.net/feed/", theme: "Tecnologia" },
  { title: "BBC News Brasil", url: "https://feeds.bbci.co.uk/portuguese/rss.xml", theme: "Notícias" },
  { title: "Quanta Magazine", url: "https://www.quantamagazine.org/feed/", theme: "Ciência" },
  { title: "Aeon", url: "https://aeon.co/feed.rss", theme: "Cultura" },
];

export const TOPIC_PRESETS = [
  { name: "Tecnologia", tone: "pink", keywords: ["tecnologia", "software", "inteligência artificial", "app", "computador", "internet"] },
  { name: "Ciência", tone: "sage", keywords: ["ciência", "pesquisa", "estudo", "cientistas", "descoberta", "universo"] },
  { name: "Cultura", tone: "lavender", keywords: ["livro", "arte", "cinema", "música", "cultura", "exposição"] },
  { name: "Bem-estar", tone: "sun", keywords: ["saúde", "sono", "meditação", "bem-estar", "alimentação"] },
];

export async function fetchFeed(url: string): Promise<{ feedUrl: string; feed: ParsedFeed }> {
  const get = async (u: string) => {
    const r = await safeFetchText(u, { timeoutMs: 8000, maxBytes: 1_500_000 });
    if (r.status >= 400) throw new Error(`O site respondeu com erro ${r.status}`);
    return r;
  };
  const r = await get(url);
  try {
    return { feedUrl: r.finalUrl, feed: parseFeed(r.text, r.finalUrl) };
  } catch {
    const alt = discoverFeedUrl(r.text, r.finalUrl);
    if (!alt) throw new Error("Não encontrei um feed RSS nesse endereço");
    const r2 = await get(alt);
    return { feedUrl: r2.finalUrl, feed: parseFeed(r2.text, r2.finalUrl) };
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof UnsafeUrlError) return e.message;
  if (e instanceof Error) return e.name === "TimeoutError" ? "O site demorou demais para responder" : e.message.slice(0, 160);
  return "Não foi possível ler o feed";
}

type FeedRow = { id: string; url: string; topic_id: string | null };

async function storeItems(userId: string, feed: FeedRow, parsed: ParsedFeed) {
  const topics = await query<{ id: string; keywords: string[] }>("SELECT id, keywords FROM topics WHERE user_id = $1", [userId]);
  for (const it of parsed.items.slice(0, 40)) {
    const topic = feed.topic_id ?? matchTopic(`${it.title} ${it.summary ?? ""}`, topics);
    await query(
      `INSERT INTO news_items (user_id, feed_id, topic_id, guid, title, link, summary, image_url, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (feed_id, guid) DO NOTHING`,
      [userId, feed.id, topic, it.guid, it.title, it.link, it.summary, it.imageUrl, it.publishedAt?.toISOString() ?? null],
    );
  }
  await query(
    `DELETE FROM news_items WHERE feed_id = $1 AND NOT favorite AND id NOT IN
       (SELECT id FROM news_items WHERE feed_id = $1 ORDER BY published_at DESC NULLS LAST, created_at DESC LIMIT ${KEEP_PER_FEED})`, [feed.id]);
}

/** Reclassifica as matérias já salvas (feeds sem tema fixo) depois de criar, editar ou apagar temas. */
export async function retagNews(userId: string): Promise<void> {
  const topics = await query<{ id: string; keywords: string[] }>("SELECT id, keywords FROM topics WHERE user_id = $1", [userId]);
  const rows = await query<{ id: string; title: string; summary: string | null; topic_id: string | null }>(
    "SELECT n.id, n.title, n.summary, n.topic_id FROM news_items n JOIN feeds f ON f.id = n.feed_id WHERE n.user_id = $1 AND f.topic_id IS NULL ORDER BY n.created_at DESC LIMIT 800", [userId]);
  for (const r of rows) {
    const next = matchTopic(`${r.title} ${r.summary ?? ""}`, topics);
    if (next !== r.topic_id) await query("UPDATE news_items SET topic_id = $2 WHERE id = $1", [r.id, next]);
  }
}

export async function refreshFeed(userId: string, feed: FeedRow): Promise<{ ok: boolean; error?: string }> {
  try {
    const { feed: parsed } = await fetchFeed(feed.url);
    await storeItems(userId, feed, parsed);
    await query("UPDATE feeds SET last_fetched_at = now(), last_error = NULL WHERE id = $1", [feed.id]);
    return { ok: true };
  } catch (e) {
    const error = friendlyError(e);
    await query("UPDATE feeds SET last_fetched_at = now(), last_error = $2 WHERE id = $1", [feed.id, error]);
    return { ok: false, error };
  }
}

export async function staleFeedCount(userId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM feeds WHERE user_id = $1 AND NOT muted AND (last_fetched_at IS NULL OR last_fetched_at < now() - ($2 || ' milliseconds')::interval)", [userId, String(MIN_REFRESH_MS)]);
  return Number(row?.n ?? 0);
}

/** Atualiza os feeds que passaram do intervalo mínimo (ou todos, com force). No máximo 4 ao mesmo tempo. */
export async function refreshFeeds(userId: string, opts: { force?: boolean } = {}): Promise<{ ok: number; failed: number }> {
  const feeds = await query<FeedRow>(
    opts.force
      ? "SELECT id, url, topic_id FROM feeds WHERE user_id = $1 AND NOT muted"
      : "SELECT id, url, topic_id FROM feeds WHERE user_id = $1 AND NOT muted AND (last_fetched_at IS NULL OR last_fetched_at < now() - ($2 || ' milliseconds')::interval)",
    opts.force ? [userId] : [userId, String(MIN_REFRESH_MS)]);
  let ok = 0, failed = 0;
  const queue = [...feeds];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      // "reserva" o feed antes de buscar, para duas telas abertas juntas não buscarem duas vezes
      if (!opts.force) {
        const claimed = await query("UPDATE feeds SET last_fetched_at = now() WHERE id = $1 AND (last_fetched_at IS NULL OR last_fetched_at < now() - ($2 || ' milliseconds')::interval) RETURNING id", [f.id, String(MIN_REFRESH_MS)]);
        if (claimed.length === 0) continue;
      }
      (await refreshFeed(userId, f)).ok ? ok++ : failed++;
    }
  }));
  return { ok, failed };
}

export async function addFeed(userId: string, rawUrl: string, topicId: string | null): Promise<{ ok: boolean; error?: string }> {
  try {
    const { feedUrl, feed } = await fetchFeed(rawUrl.trim());
    const rows = await query<FeedRow>(
      `INSERT INTO feeds (user_id, title, url, site_url, topic_id) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, url) DO UPDATE SET title = EXCLUDED.title RETURNING id, url, topic_id`, [userId, feed.title, feedUrl, feed.siteUrl, topicId]);
    await storeItems(userId, rows[0], feed);
    await query("UPDATE feeds SET last_fetched_at = now(), last_error = NULL WHERE id = $1", [rows[0].id]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e) };
  }
}
