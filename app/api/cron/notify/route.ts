import { timingSafeEqual } from "node:crypto";
import { pushConfig } from "@/lib/push/config";
import { runNotify } from "@/lib/push/notify";

export const dynamic = "force-dynamic";
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Chamada a cada poucos minutos por um agendador externo (GitHub Actions ou cron-job.org) com
 * `Authorization: Bearer <CRON_SECRET>`. Decide quais avisos enviar agora, respeitando horário silencioso e limite diário.
 */
export async function GET(req: Request) {
  const c = pushConfig();
  if (!c.cronConfigured) return Response.json({ ok: false, error: "CRON_SECRET não configurado (mínimo 16 caracteres)" }, { status: 503 });
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !same(given, c.cronSecret)) return Response.json({ ok: false, error: "não autorizado" }, { status: 401 });
  return Response.json({ ok: true, ...(await runNotify()) });
}
