import * as webpush from "web-push";
import { query } from "@/lib/db";
import { pushConfig, pushSink } from "./config";

export type PushPayload = { title: string; body: string; url?: string; tag?: string };
type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

let configured = "";
function setup() {
  const c = pushConfig();
  const sig = `${c.publicKey}|${c.subject}`;
  if (c.configured && configured !== sig) {
    // chaves malformadas não derrubam o app: tratamos como "não configurado"
    try { webpush.setVapidDetails(c.subject, c.publicKey, c.privateKey); configured = sig; } catch { return { ...c, configured: false }; }
  }
  return c;
}

export async function subscriptionsOf(userId: string): Promise<Sub[]> {
  return query<Sub>("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at", [userId]);
}

/** Envia para todos os aparelhos da pessoa. Inscrições mortas (404/410) são apagadas. */
export async function sendPush(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number; removed: number }> {
  const c = setup();
  const sink = pushSink();
  if (!c.configured && !sink) return { sent: 0, failed: 0, removed: 0 };
  const body = JSON.stringify({ title: payload.title.slice(0, 80), body: payload.body.slice(0, 200), url: payload.url ?? "/", tag: payload.tag });
  let sent = 0, failed = 0, removed = 0;
  for (const s of await subscriptionsOf(userId)) {
    try {
      if (sink) {
        const r = await fetch(sink, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: s.endpoint, payload: JSON.parse(body) }), signal: AbortSignal.timeout(5000) });
        if (!r.ok) throw Object.assign(new Error("sink"), { statusCode: r.status });
      } else {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 3600, urgency: "normal", timeout: 8000 });
      }
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { await query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]); removed++; } else failed++;
    }
  }
  return { sent, failed, removed };
}
