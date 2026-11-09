import { z } from "zod";
import { Box, Group, Stack, Text } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { fetchOccurrences } from "@/lib/agenda/queries";
import { freeSlots } from "@/lib/agenda/free-slots";
import { addDays, addMonths, cap, formatDateLong, formatMonth, isDateKey, localDateKey, parseTime, startOfMonth, startOfWeek } from "@/lib/time";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { DayTimeline } from "@/components/agenda/DayTimeline";
import { WeekView } from "@/components/agenda/WeekView";
import { MonthView } from "@/components/agenda/MonthView";

export const metadata = { title: "Agenda" };

const VIEWS = [{ v: "dia", label: "Dia" }, { v: "semana", label: "Semana" }, { v: "mes", label: "Mês" }] as const;

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ v?: string; d?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = localDateKey();
  const view = z.enum(["dia", "semana", "mes"]).catch("dia").parse(sp.v);
  const date = isDateKey(sp.d) ? sp.d : today;

  let from: string, to: string, prev: string, next: string, title: string;
  if (view === "dia") { from = to = date; prev = addDays(date, -1); next = addDays(date, 1); title = formatDateLong(date); }
  else if (view === "semana") { from = startOfWeek(date); to = addDays(from, 6); prev = addDays(date, -7); next = addDays(date, 7); title = `${formatDateLong(from).split(",")[1]?.trim() ?? from} – ${formatDateLong(to).split(",")[1]?.trim() ?? to}`; }
  else { const m = startOfMonth(date); from = startOfWeek(m); to = addDays(startOfWeek(addMonths(m, 1)), 6); prev = addMonths(m, -1); next = addMonths(m, 1); title = formatMonth(m); }

  const [occurrences, settings] = await Promise.all([fetchOccurrences(user.id, from, to), getSettings(user.id)]);
  const href = (v: string, d: string) => `/agenda?v=${v}&d=${d}`;

  const dayOccs = view === "dia" ? occurrences : [];
  const slots = view === "dia" ? freeSlots(dayOccs, parseTime(settings.wake) ?? 420, parseTime(settings.sleep) ?? 1380) : [];

  return (
    <>
      <PageHeader title="Agenda" />
      <Stack gap="md">
        <Group gap="xs" grow>
          {VIEWS.map(({ v, label }) => (
            <LinkButton key={v} href={href(v, date)} variant={v === view ? "filled" : "light"} size="xs">{label}</LinkButton>
          ))}
        </Group>
        <Group justify="space-between" wrap="nowrap">
          <LinkButton href={href(view, prev)} variant="subtle" size="md" px="sm" aria-label="Anterior">‹</LinkButton>
          <Box ta="center">
            <Text fw={800}>{cap(title)}</Text>
            {date !== today && <LinkButton href={href(view, today)} variant="subtle" size="compact-xs">Ir para hoje</LinkButton>}
          </Box>
          <LinkButton href={href(view, next)} variant="subtle" size="md" px="sm" aria-label="Próximo">›</LinkButton>
        </Group>

        {view === "dia" && <DayTimeline occurrences={dayOccs} freeSlots={slots} nowMin={undefined} emptyText="Nada marcado. Dia livre 🌿" />}
        {view === "semana" && <WeekView start={from} occurrences={occurrences} today={today} />}
        {view === "mes" && <MonthView month={startOfMonth(date)} occurrences={occurrences} today={today} />}

        <Group grow>
          <LinkButton href={`/agenda/evento/novo?d=${date}`}>+ Novo evento</LinkButton>
          <LinkButton href="/agenda/rotina" variant="light">Rotina-modelo</LinkButton>
        </Group>
      </Stack>
    </>
  );
}
