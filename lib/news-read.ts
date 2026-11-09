import { query, queryOne } from "@/lib/db";
import { getProvider, AiError } from "@/lib/ai";
import { aiAvailability } from "@/lib/planner/service";
import { getSettings } from "@/lib/settings";
import { getArticleText, summarizeText } from "@/lib/article";
import { localDateKey } from "@/lib/time";

type NewsRow = { id: string; title: string; link: string; summary: string | null; summary_source: string | null; image_url: string | null; read: boolean; reading_item_id: string | null; source: string };

export async function loadNews(userId: string, id: string): Promise<NewsRow | null> {
  return queryOne<NewsRow>(
    `SELECT n.id, n.title, n.link, n.summary, n.summary_source, n.image_url, n.read, n.reading_item_id, f.title AS source
       FROM news_items n JOIN feeds f ON f.id = n.feed_id WHERE n.id = $1 AND n.user_id = $2`, [id, userId]);
}

/**
 * Marcar como lida: a matéria sai das não lidas e vira (ou atualiza) um artigo lido em Leituras.
 * Se já existe um artigo com o mesmo link, ele é atualizado em vez de duplicado.
 */
export async function markNewsRead(userId: string, id: string): Promise<boolean> {
  const n = await loadNews(userId, id);
  if (!n) return false;
  const rows = await query<{ id: string }>(
    `INSERT INTO reading_items (user_id, kind, title, author, url, cover_url, summary, status, finished_on, source, source_news_id)
     VALUES ($1,'artigo',$2,$3,$4,$5,$6,'lido',$7::date,'noticia',$8)
     ON CONFLICT (user_id, url) WHERE kind = 'artigo' AND url IS NOT NULL DO UPDATE SET
       status = 'lido',
       finished_on = CASE WHEN reading_items.status = 'lido' THEN COALESCE(reading_items.finished_on, EXCLUDED.finished_on) ELSE EXCLUDED.finished_on END,
       summary = COALESCE(EXCLUDED.summary, reading_items.summary),
       author = COALESCE(reading_items.author, EXCLUDED.author),
       cover_url = COALESCE(reading_items.cover_url, EXCLUDED.cover_url),
       source_news_id = COALESCE(reading_items.source_news_id, EXCLUDED.source_news_id)
     RETURNING id`,
    [userId, n.title.slice(0, 200), n.source.slice(0, 120), n.link, n.image_url, n.summary, localDateKey(), n.id]);
  await query("UPDATE news_items SET read = true, reading_item_id = $3 WHERE id = $1 AND user_id = $2", [n.id, userId, rows[0].id]);
  return true;
}

/** Desmarcar: a matéria volta às não lidas e o artigo volta para "quero ler". */
export async function markNewsUnread(userId: string, id: string): Promise<boolean> {
  const n = await loadNews(userId, id);
  if (!n) return false;
  await query("UPDATE news_items SET read = false WHERE id = $1 AND user_id = $2", [n.id, userId]);
  const link = n.reading_item_id
    ? await query("UPDATE reading_items SET status = 'quero', finished_on = NULL WHERE id = $1 AND user_id = $2 RETURNING id", [n.reading_item_id, userId])
    : await query("UPDATE reading_items SET status = 'quero', finished_on = NULL WHERE user_id = $1 AND kind = 'artigo' AND url = $2 RETURNING id", [userId, n.link]);
  void link;
  return true;
}

/** "Salvar para ler depois": cria o artigo com status "quero ler" (ou reaproveita o que já existe com o mesmo link). */
export async function saveNewsForLater(userId: string, id: string): Promise<boolean> {
  const n = await loadNews(userId, id);
  if (!n) return false;
  const rows = await query<{ id: string }>(
    `INSERT INTO reading_items (user_id, kind, title, author, url, cover_url, summary, status, source, source_news_id)
     VALUES ($1,'artigo',$2,$3,$4,$5,$6,'quero','noticia',$7)
     ON CONFLICT (user_id, url) WHERE kind = 'artigo' AND url IS NOT NULL DO UPDATE SET source_news_id = COALESCE(reading_items.source_news_id, EXCLUDED.source_news_id)
     RETURNING id`, [userId, n.title.slice(0, 200), n.source.slice(0, 120), n.link, n.image_url, n.summary, n.id]);
  await query("UPDATE news_items SET reading_item_id = $3 WHERE id = $1 AND user_id = $2", [n.id, userId, rows[0].id]);
  return true;
}

/** Garante um resumo simples (sem IA) para a matéria, gerado do texto quando o feed não trouxe descrição. */
export async function ensureTextSummary(userId: string, n: NewsRow): Promise<string | null> {
  if (n.summary && n.summary.length >= 60) return n.summary;
  const art = await getArticleText(n.link);
  const s = summarizeText(art.paragraphs);
  if (!s) return n.summary;
  await query("UPDATE news_items SET summary = $3, summary_source = 'texto' WHERE id = $1 AND user_id = $2 AND (summary IS NULL OR char_length(summary) < 60)", [n.id, userId, s]);
  return s;
}

const SYSTEM = "Você resume matérias de notícias em português do Brasil, em até 3 frases curtas, de forma neutra e fiel ao texto. Não invente fatos, não opine e não use listas. Responda só com o resumo.";

export type AiSummaryResult = { ok: boolean; error?: string; summary?: string };

/** Resumo com IA, sob demanda: usa o Gemini dentro do limite diário e guarda o resultado. Sem IA, o resumo simples continua. */
export async function summarizeNewsWithAi(userId: string, id: string): Promise<AiSummaryResult> {
  const n = await loadNews(userId, id);
  if (!n) return { ok: false, error: "Matéria não encontrada." };
  const settings = await getSettings(userId);
  const avail = await aiAvailability(userId, settings);
  if (!avail.ok) {
    const why = { disabled: "A IA está desligada em Configurações.", no_key: "A IA ainda não foi configurada.", limit: "O limite diário de chamadas à IA foi atingido.", cooldown: "A IA falhou há pouco; tente de novo em alguns minutos." }[avail.reason];
    return { ok: false, error: `${why} O resumo simples continua disponível.` };
  }
  const art = await getArticleText(n.link);
  const material = art.paragraphs.length ? art.paragraphs.join("\n").slice(0, 7000) : [n.title, n.summary].filter(Boolean).join("\n");
  try {
    const raw = await getProvider()!.generate({ system: SYSTEM, prompt: `Título: ${n.title}\n\nTexto:\n${material}` });
    const summary = raw.replace(/\s+/g, " ").trim().slice(0, 700);
    if (summary.length < 20) throw new AiError("format", "resumo vazio");
    await query("UPDATE news_items SET summary = $3, summary_source = 'ia' WHERE id = $1 AND user_id = $2", [n.id, userId, summary]);
    await query("UPDATE reading_items SET summary = $3 WHERE user_id = $1 AND kind = 'artigo' AND url = $2", [userId, n.link, summary]);
    await query("INSERT INTO ai_requests (user_id, kind, outcome, reason, provider_called) VALUES ($1,'summary','ai',NULL,true)", [userId]);
    return { ok: true, summary };
  } catch (e) {
    const reason = e instanceof AiError ? e.reason : "http";
    await query("INSERT INTO ai_requests (user_id, kind, outcome, reason, provider_called, response) VALUES ($1,'summary','failed',$2,true,$3::jsonb)", [userId, reason, JSON.stringify({ detail: e instanceof AiError ? (e.detail ?? null) : null })]);
    return { ok: false, error: "Não consegui resumir agora. O resumo simples continua disponível." };
  }
}
