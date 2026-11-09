import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";

export const SESSION_COOKIE = "mki_session";
const SESSION_DAYS = 30;

export type SessionUser = { id: string; username: string };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, userAgent: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query(
    "INSERT INTO sessions (user_id, token_hash, user_agent, expires_at) VALUES ($1, $2, $3, $4)",
    [userId, hashToken(token), userAgent?.slice(0, 300) ?? null, expires.toISOString()],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

/** Valida um token de cookie e devolve o usuário (ou null). */
export async function userFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  return queryOne<SessionUser>(
    `UPDATE sessions s
        SET last_seen_at = now()
       FROM users u
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.id = s.user_id
  RETURNING u.id, u.username`,
    [hashToken(token)],
  );
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function destroySession(allDevices = false): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    if (allDevices) {
      await query(
        "DELETE FROM sessions WHERE user_id = (SELECT user_id FROM sessions WHERE token_hash = $1)",
        [hashToken(token)],
      );
    } else {
      await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
    }
  }
  jar.delete(SESSION_COOKIE);
}
