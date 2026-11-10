import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";

const sub = z.object({ endpoint: z.string().url().max(1000).refine((u) => u.startsWith("https://"), "O endereço precisa ser HTTPS"), keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }) });

/** Guarda a inscrição de notificações deste aparelho (cada aparelho tem a sua). */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const p = sub.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false, error: "inscrição inválida" }, { status: 400 });
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4, user_agent = $5`,
    [user.id, p.data.endpoint, p.data.keys.p256dh, p.data.keys.auth, (req.headers.get("user-agent") ?? "").slice(0, 300) || null]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint === "string") await query("DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2", [user.id, body.endpoint]);
  return NextResponse.json({ ok: true });
}
