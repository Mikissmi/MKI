export type PushConfig = { configured: boolean; missing: string[]; publicKey: string; privateKey: string; subject: string; cronSecret: string; cronConfigured: boolean };

/** Chaves das notificações (VAPID) e segredo do agendador, só por variáveis de ambiente. */
export function pushConfig(env: Record<string, string | undefined> = process.env): PushConfig {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = env.VAPID_SUBJECT?.trim() ?? "";
  const cronSecret = env.CRON_SECRET?.trim() ?? "";
  const missing: string[] = [];
  if (!publicKey) missing.push("VAPID_PUBLIC_KEY");
  if (!privateKey) missing.push("VAPID_PRIVATE_KEY");
  if (!/^(mailto:|https:\/\/)/.test(subject)) missing.push("VAPID_SUBJECT");
  const cronConfigured = cronSecret.length >= 16;
  return { configured: missing.length === 0, missing, publicKey, privateKey, subject, cronSecret, cronConfigured };
}

/** Só para testes locais: em vez de falar com o serviço de push do navegador, entrega a um servidor falso. */
export function pushSink(env: Record<string, string | undefined> = process.env): string | null {
  if (env.MKI_DEV_ALLOW_LOOPBACK !== "1" || !env.MKI_PUSH_SINK) return null;
  try { return ["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL ?? "").hostname) ? env.MKI_PUSH_SINK : null; } catch { return null; }
}
