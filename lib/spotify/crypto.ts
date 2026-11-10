import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia dos tokens do Spotify: AES-256-GCM com IV aleatório por valor.
 * A chave (32 bytes em base64) vem de SPOTIFY_TOKEN_KEY e nunca é gravada nem registrada em logs.
 */
const PREFIX = "v1";

export function loadKey(raw = process.env.SPOTIFY_TOKEN_KEY): Buffer | null {
  if (!raw) return null;
  try {
    const key = Buffer.from(raw.trim(), "base64");
    return key.length === 32 ? key : null;
  } catch { return null; }
}

export function encryptToken(plain: string, key = loadKey()): string {
  if (!key) throw new Error("SPOTIFY_TOKEN_KEY ausente ou inválida (precisa ser 32 bytes em base64)");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [PREFIX, iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}

/** Devolve o texto original, ou null se o valor foi adulterado ou a chave não confere. */
export function decryptToken(enc: string, key = loadKey()): string | null {
  if (!key) return null;
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== PREFIX || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}
