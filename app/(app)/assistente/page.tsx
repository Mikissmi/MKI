import { Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings, AI_DAILY_LIMIT } from "@/lib/settings";
import { aiAvailability, aiUsageToday } from "@/lib/planner/service";
import { PageHeader } from "@/components/PageHeader";
import { ChatClient, type ChatMsg } from "@/components/ChatClient";
import { Pill } from "@/components/ui/Panel";
import type { PlanBlock } from "@/lib/planner/types";

export const metadata = { title: "Assistente" };

export default async function AssistantPage() {
  const user = await requireUser();
  const [settings, rows, usage] = await Promise.all([
    getSettings(user.id),
    query<{ id: string; role: "user" | "assistant"; content: string; plan: PlanBlock[] | null; source: string | null }>(
      "SELECT id, role, content, plan, source FROM (SELECT * FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30) m ORDER BY created_at", [user.id]),
    aiUsageToday(user.id),
  ]);
  const avail = await aiAvailability(user.id, settings);
  const initial: ChatMsg[] = rows.map((r) => ({ id: r.id, role: r.role, content: r.content, source: r.source, plan: r.plan ? r.plan.map((b) => ({ startMin: b.startMin, durationMin: b.durationMin, kind: b.kind, title: b.title, reason: b.reason })) : null }));
  return (
    <>
      <PageHeader title="Assistente" back="/mais" action={avail.ok ? <Pill tone="sage" icon="sparkles">IA ligada</Pill> : <Pill tone="lavender" icon="lock">modo regras</Pill>} />
      <Text size="xs" c="dimmed" mb="sm">{usage} de {AI_DAILY_LIMIT} chamadas de IA usadas hoje. A IA só propõe: nada muda na sua agenda sem você aceitar.</Text>
      <ChatClient initial={initial} />
    </>
  );
}
