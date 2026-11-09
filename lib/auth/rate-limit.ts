import { query, queryOne } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 5;

export async function isLoginBlocked(key: string): Promise<boolean> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM login_attempts
      WHERE key = $1 AND attempted_at > now() - make_interval(mins => $2)`,
    [key, WINDOW_MINUTES],
  );
  return Number(row?.n ?? 0) >= MAX_ATTEMPTS;
}

export async function recordFailedLogin(key: string): Promise<void> {
  await query("INSERT INTO login_attempts (key) VALUES ($1)", [key]);
  await query("DELETE FROM login_attempts WHERE attempted_at < now() - interval '1 day'");
}

export async function clearLoginAttempts(key: string): Promise<void> {
  await query("DELETE FROM login_attempts WHERE key = $1", [key]);
}
