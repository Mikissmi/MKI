import { toPlainText } from "@/lib/rss";
import { safeFetchText } from "@/lib/safe-fetch";

/** Remove blocos que nunca são o texto da matéria (scripts, menus, rodapés, formulários...). */
function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|svg|iframe|form|nav|header|footer|aside|button|select|dialog|figure)\b[\s\S]*?<\/\1>/gi, " ");
}

const BOILERPLATE = /^(leia (também|mais)|veja (também|mais)|publicidade|anúncio|compartilhe|siga[- ]nos|assine|receba nossa newsletter|newsletter|aceitar cookies|todos os direitos reservados|copyright|©)/i;
const PAYWALL = /(assine para continuar|conteúdo exclusivo para assinantes|exclusivo para assinantes|já é assinante|faça login para ler|subscribe to (continue|read)|this content is for subscribers|sign in to continue reading)/i;

export type Readable = { paragraphs: string[]; ok: boolean; paywall: boolean };

/** Modo leitura: acha o conteúdo principal e devolve só texto puro (nunca HTML de terceiros). */
export function extractReadable(html: string): Readable {
  const clean = stripNoise(html);
  const containers = [...clean.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map((m) => m[1]);
  const biggest = containers.sort((a, b) => b.length - a.length)[0];
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(clean)?.[1];
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(clean)?.[1] ?? clean;

  const grab = (scope: string): string[] => {
    const out: string[] = [];
    for (const m of scope.matchAll(/<(p|h2|h3|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const tag = m[1].toLowerCase();
      const t = toPlainText(m[2]);
      if (!t || BOILERPLATE.test(t)) continue;
      if (tag === "p" || tag === "blockquote") { if (t.length >= 40) out.push(t); }
      else if (tag === "li") { if (t.length >= 60) out.push(t); }
      else if (t.length >= 8 && t.length <= 140) out.push(t);
    }
    return out.filter((p, i) => p !== out[i - 1]);
  };

  let paragraphs = biggest ? grab(biggest) : [];
  if (paragraphs.length < 3 && main) paragraphs = grab(main);
  if (paragraphs.length < 3) paragraphs = grab(body);
  // títulos de seção sem texto em volta não valem
  const proseCount = paragraphs.filter((p) => p.length >= 40).length;
  const capped: string[] = [];
  let total = 0;
  for (const p of paragraphs.slice(0, 80)) { total += p.length; if (total > 24_000) break; capped.push(p); }
  const chars = capped.join(" ").length;
  const paywall = PAYWALL.test(toPlainText(clean).slice(0, 60_000)) && chars < 2500;
  return { paragraphs: capped, ok: proseCount >= 3 && chars >= 500 && !paywall, paywall };
}

/** Resumo simples, sem IA: as primeiras frases do texto (até 3, em no máximo ~320 caracteres). */
export function summarizeText(paragraphs: string[], max = 320): string | null {
  const text = paragraphs.filter((p) => p.length >= 40).slice(0, 4).join(" ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?…])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9"“'(])/);
  let out = "";
  let n = 0;
  for (const s of sentences) {
    if (n >= 3 || (out && (out + " " + s).length > max)) break;
    out = out ? `${out} ${s}` : s;
    n++;
  }
  if (out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, "") + "…";
  return out || null;
}

// ---- cache temporário do texto (só em memória: o texto completo nunca vai para o banco) ----
const TTL_MS = 20 * 60_000;
const MAX_ENTRIES = 40;
const cache = new Map<string, { at: number; value: Readable & { error?: string } }>();

export async function getArticleText(url: string): Promise<Readable & { error?: string }> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value: Readable & { error?: string };
  try {
    const r = await safeFetchText(url, { timeoutMs: 8000, maxBytes: 1_500_000 });
    if (r.status >= 400) value = { paragraphs: [], ok: false, paywall: r.status === 401 || r.status === 402, error: `O site respondeu com erro ${r.status}` };
    else value = extractReadable(r.text);
  } catch (e) {
    value = { paragraphs: [], ok: false, paywall: false, error: e instanceof Error ? e.message.slice(0, 120) : "Não foi possível abrir o site" };
  }
  cache.set(url, { at: Date.now(), value });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  return value;
}
