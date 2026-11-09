import { query, queryOne } from "@/lib/db";
import { parseTime } from "@/lib/time";

export type Settings = { wake: string; sleep: string };
const DEFAULTS: Settings = { wake: "07:00", sleep: "23:00" };

export async function getSettings(userId: string): Promise<Settings> {
  const row = await queryOne<{ data: Partial<Settings> }>("SELECT data FROM settings WHERE user_id = $1", [userId]);
  const d = row?.data ?? {};
  return {
    wake: typeof d.wake === "string" && parseTime(d.wake) !== null ? d.wake : DEFAULTS.wake,
    sleep: typeof d.sleep === "string" && parseTime(d.sleep) !== null ? d.sleep : DEFAULTS.sleep,
  };
}

export async function patchSettings(userId: string, patch: Partial<Settings>): Promise<void> {
  await query(
    `INSERT INTO settings (user_id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET data = settings.data || $2::jsonb, updated_at = now()`,
    [userId, JSON.stringify(patch)],
  );
}
