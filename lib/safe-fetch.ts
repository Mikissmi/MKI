import { lookup } from "node:dns/promises";
import net from "node:net";

/** true se o IP é de rede interna/privada/reservada (loopback, link-local, metadata de nuvem, etc.). */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateIp(mapped[1]);
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return true; // não é IP válido: trata como inseguro
}

export class UnsafeUrlError extends Error {}

/**
 * Só para testes locais: com MKI_DEV_ALLOW_LOOPBACK=1 e banco em localhost, permite buscar 127.0.0.1/localhost.
 * Nunca vale em produção (o banco do Neon não é localhost).
 */
function devLoopbackAllowed(host: string): boolean {
  if (process.env.MKI_DEV_ALLOW_LOOPBACK !== "1" || !(host === "127.0.0.1" || host === "localhost")) return false;
  try { return ["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL ?? "").hostname); } catch { return false; }
}

export async function assertPublicUrl(raw: string | URL): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UnsafeUrlError("Link inválido"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new UnsafeUrlError("Use um link http ou https");
  if (u.username || u.password) throw new UnsafeUrlError("Link com usuário/senha não é permitido");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (devLoopbackAllowed(host)) return u;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new UnsafeUrlError("Endereço interno bloqueado");
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("Endereço interno bloqueado");
    return u;
  }
  let addrs: { address: string }[];
  try { addrs = await lookup(host, { all: true }); } catch { throw new UnsafeUrlError("Não foi possível resolver o endereço"); }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new UnsafeUrlError("Endereço interno bloqueado");
  return u;
}

export type SafeResponse = { finalUrl: string; status: number; contentType: string; text: string };

/** Busca uma página pública com limites: só http(s), sem redes internas (a cada redirecionamento), tempo limite e tamanho máximo. */
export async function safeFetchText(url: string, opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {}): Promise<SafeResponse> {
  const { timeoutMs = 8000, maxBytes = 1_000_000, maxRedirects = 3 } = opts;
  let current = await assertPublicUrl(url);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const res = await fetch(current, {
      redirect: "manual", signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "Mozilla/5.0 (compatible; MKI/1.0)", accept: "text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = await assertPublicUrl(new URL(res.headers.get("location")!, current));
      continue;
    }
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { chunks.push(value.slice(0, value.length - (total - maxBytes))); await reader.cancel(); break; }
      chunks.push(value);
    }
    return { finalUrl: current.toString(), status: res.status, contentType: res.headers.get("content-type") ?? "", text: new TextDecoder().decode(Buffer.concat(chunks)) };
  }
  throw new UnsafeUrlError("Redirecionamentos demais");
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim();

/** Título (og:title ou <title>) e imagem de capa de uma página, se houver. */
export function extractMeta(html: string): { title: string | null; image: string | null } {
  const og = (p: string) => new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)["']`, "i").exec(html)?.[1] ?? new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`, "i").exec(html)?.[1];
  const title = og("og:title") ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const image = og("og:image");
  return { title: title ? decode(title).slice(0, 200) : null, image: image && /^https?:\/\//i.test(image) ? image : null };
}

/** Título automático de um link (para "salvar para ler depois"). Nunca lança: falhas devolvem null. */
export async function fetchLinkMeta(url: string): Promise<{ title: string | null; image: string | null }> {
  try {
    const r = await safeFetchText(url, { timeoutMs: 6000, maxBytes: 300_000 });
    return r.status < 400 ? extractMeta(r.text) : { title: null, image: null };
  } catch { return { title: null, image: null }; }
}
