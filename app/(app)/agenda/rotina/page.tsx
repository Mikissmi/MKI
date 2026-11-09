import { Stack, Text, Title } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { fetchRoutine } from "@/lib/agenda/queries";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { HoursForm, RoutineBlocks } from "@/components/agenda/RoutineForms";

export const metadata = { title: "Rotina-modelo" };

export default async function RoutinePage() {
  const user = await requireUser();
  const [settings, blocks] = await Promise.all([getSettings(user.id), fetchRoutine(user.id)]);
  return (
    <>
      <PageHeader title="Rotina-modelo" subtitle="A base do planejamento: o que se repete toda semana." />
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={4}>Acordar e dormir</Title>
          <Text size="sm" c="dimmed">Os horários livres do dia contam só entre esses dois horários.</Text>
          <HoursForm wake={settings.wake} sleep={settings.sleep} />
        </Stack>
        <Stack gap="xs">
          <Title order={4}>Blocos fixos</Title>
          <RoutineBlocks blocks={blocks} />
        </Stack>
        <LinkButton href="/agenda" variant="subtle">‹ Voltar à agenda</LinkButton>
      </Stack>
    </>
  );
}
