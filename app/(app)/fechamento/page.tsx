import { Stack, Text } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { daySummary, getClosing } from "@/lib/closing";
import { brl } from "@/lib/format";
import { localDateKey } from "@/lib/time";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ClosingForm } from "@/components/ClosingForm";

export const metadata = { title: "Fechamento da noite" };

export default async function ClosingPage() {
  const user = await requireUser();
  const today = localDateKey();
  const [sum, closing] = await Promise.all([daySummary(user.id, today), getClosing(user.id, today)]);
  return (
    <>
      <PageHeader title="Fechamento da noite" back="/" />
      <Stack gap="md">
        <Panel tone="lavender" title="O que você fez hoje" icon="moon">
          <Stack gap={4}>
            <Text size="sm">Hábitos: {sum.habitsDone} de {sum.habitsTotal}</Text>
            <Text size="sm">Atividades: {sum.activities.length ? sum.activities.map((a) => `${a.name} (${a.minutes} min)`).join(", ") : "nenhuma registrada"}</Text>
            <Text size="sm">Páginas lidas: {sum.pages}</Text>
            <Text size="sm">Gastos: {brl(sum.spentCents)}</Text>
          </Stack>
        </Panel>
        <Panel tone="plain" title="Fechar o dia" icon="check">
          <ClosingForm initial={{ line: closing?.line ?? null, priorities: closing?.priorities ?? [], focus: closing?.focus ?? null }} />
        </Panel>
        <Text size="xs" c="dimmed">O que você escrever aparece na tela Hoje de amanhã e na sua retrospectiva.</Text>
      </Stack>
    </>
  );
}
