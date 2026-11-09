import { Card, Group, Stack, Text, Title } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { fetchCheckin, fetchOccurrences } from "@/lib/agenda/queries";
import { freeSlots } from "@/lib/agenda/free-slots";
import { formatDateLong, localDateKey, localMinutes, parseTime } from "@/lib/time";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { CheckinCard } from "@/components/agenda/CheckinCard";
import { DayTimeline } from "@/components/agenda/DayTimeline";

function greeting(min: number) {
  if (min < 12 * 60) return "Bom dia";
  if (min < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

export default async function TodayPage() {
  const user = await requireUser();
  const now = new Date();
  const today = localDateKey(now);
  const nowMin = localMinutes(now);

  const [occurrences, settings, checkin] = await Promise.all([
    fetchOccurrences(user.id, today, today), getSettings(user.id), fetchCheckin(user.id, today),
  ]);
  const wake = parseTime(settings.wake) ?? 420, sleep = parseTime(settings.sleep) ?? 1380;
  // Para hoje, só interessa o tempo livre que ainda não passou.
  const slots = freeSlots(occurrences, Math.max(wake, nowMin), sleep);

  return (
    <>
      <PageHeader title={`${greeting(nowMin)}, ${user.username} 🌸`} subtitle={formatDateLong(today)} />
      <Stack gap="md">
        <CheckinCard initial={checkin ? { mood: checkin.mood, energy: checkin.energy, note: checkin.note } : null} />
        <Card>
          <Group justify="space-between" mb="sm">
            <Title order={4}>Plano do dia</Title>
            <LinkButton href="/agenda/evento/novo" size="compact-sm" variant="light">+ Evento</LinkButton>
          </Group>
          <DayTimeline occurrences={occurrences} freeSlots={slots} nowMin={nowMin} emptyText="Nada marcado para hoje. Dia livre 🌿" />
          <Text size="xs" c="dimmed" mt="sm">As sugestões de atividades para os horários livres chegam nas próximas etapas.</Text>
        </Card>
      </Stack>
    </>
  );
}
