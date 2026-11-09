import Link from "next/link";
import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { delta, getRetro, nextStart, periodEnd, periodStart, prevStart, type Period, type RetroData } from "@/lib/retro";
import { cap, formatDateLong, formatDateShort, formatMonth, isDateKey, localDateKey, weekday } from "@/lib/time";
import { brl } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/options";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { Panel, Pill } from "@/components/ui/Panel";
import { TabLinks } from "@/components/ui/TabLinks";
import { Donut, LineChart, Ring } from "@/components/ui/charts";
import { ReflectionForm } from "@/components/ReflectionForm";

export const metadata = { title: "Retrospectivas" };
const DAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const rangeText = (period: Period, s: string, e: string) => (period === "mes" ? cap(formatMonth(s)) : `${formatDateShort(s)} a ${formatDateShort(e)}`);

function Compare({ label, now, before, fmt = (n: number) => String(n), goodWhenUp = true }: { label: string; now: number; before: number | null; fmt?: (n: number) => string; goodWhenUp?: boolean }) {
  const d = delta(now, before);
  const good = d.dir === "same" || d.dir === "none" ? null : (d.dir === "up") === goodWhenUp;
  return <Group justify="space-between" wrap="nowrap"><Text size="sm">{label}</Text><Group gap={8} wrap="nowrap"><Text size="sm" fw={800}>{fmt(now)}</Text><Text size="xs" c={good === null ? "dimmed" : good ? "sage.7" : "lotus.7"}>{d.text}</Text></Group></Group>;
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <Stack gap={2}>{items.slice(0, 5).map((i) => <Text key={i} size="sm" lh={1.3}>{i}</Text>)}{items.length > 5 && <Text size="xs" c="dimmed">+{items.length - 5}</Text>}</Stack> : <Text size="xs" style={{ opacity: 0.7 }}>{empty}</Text>;
}

export default async function RetroPage({ searchParams }: { searchParams: Promise<{ p?: string; d?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = localDateKey();
  const period: Period = sp.p === "mes" ? "mes" : "semana";
  const start = periodStart(period, isDateKey(sp.d) ? sp.d : today);
  const end = periodEnd(period, start);
  const { data, reflection } = await getRetro(user.id, period, start, today);
  if (end < today) await query("UPDATE retrospectives SET viewed_at = COALESCE(viewed_at, now()) WHERE user_id = $1 AND period = $2 AND start_on = $3::date", [user.id, period, start]);
  const album = await query<{ period: Period; start_on: string; end_on: string; label: string | null; reflection: string | null }>(
    "SELECT period, start_on::text AS start_on, end_on::text AS end_on, data->>'label' AS label, reflection FROM retrospectives WHERE user_id = $1 AND NOT (period = $3 AND start_on = $2::date) ORDER BY start_on DESC LIMIT 24", [user.id, start, period]);
  const d: RetroData = data;
  const labels = d.mood.map((m, i) => (period === "semana" ? DAY[weekday(m.date)] : (i % 5 === 0 || i === d.mood.length - 1 ? String(Number(m.date.slice(8))) : "")));
  const hasMood = d.mood.some((m) => m.mood !== null);
  const catMax = Math.max(1, ...d.spending.byCategory.map((c) => c.total));
  const screenTotal = d.screen.com + d.screen.sem;
  const unit = period === "semana" ? "da semana" : "do mês";
  const p = d.previous;

  return (
    <>
      <PageHeader title={period === "semana" ? "Retrospectiva semanal" : "Retrospectiva mensal"} back="/mais" />
      <Stack gap="md">
        <TabLinks active={period} items={[{ key: "semana", label: "Semanal", href: "/retrospectivas?p=semana" }, { key: "mes", label: "Mensal", href: "/retrospectivas?p=mes" }]} />
        <Group justify="space-between" wrap="nowrap">
          <LinkButton href={`/retrospectivas?p=${period}&d=${prevStart(period, start)}`} variant="subtle" size="compact-md" aria-label="Período anterior">‹</LinkButton>
          <Box ta="center"><Text fw={800}>{rangeText(period, start, end)}</Text>{d.partial && <Text size="xs" c="dimmed">em andamento</Text>}</Box>
          <LinkButton href={`/retrospectivas?p=${period}&d=${nextStart(period, start)}`} variant="subtle" size="compact-md" aria-label="Próximo período" disabled={nextStart(period, start) > today}>›</LinkButton>
        </Group>

        <Panel tone="pink" title={`Visão geral ${unit}`} icon="calendar" action={d.label ? <Pill tone="sage" icon="star">{d.label}</Pill> : undefined}>
          <Text size="sm" style={{ opacity: 0.85 }}>Resumo de {formatDateLong(start).split(",")[1]?.trim() ?? start} a {formatDateLong(end).split(",")[1]?.trim() ?? end}. {d.habits.scheduled === 0 && d.activities.total === 0 && !hasMood ? "Ainda não há registros neste período." : ""}</Text>
        </Panel>

        <Panel tone="plain" title={`Humor e energia ${period === "semana" ? "ao longo da semana" : "do mês"}`} icon="mood-4">
          {hasMood ? (<>
            <LineChart labels={labels} min={1} max={5} series={[{ name: "Humor", color: "#e85d97", points: d.mood.map((m) => m.mood) }, { name: "Energia", color: "#f2c534", points: d.mood.map((m) => m.energy) }]} />
            <Group gap="md" justify="center"><Text size="xs">Humor médio <b>{d.moodAvg ?? "-"}</b></Text><Text size="xs">Energia média <b>{d.energyAvg ?? "-"}</b></Text></Group>
          </>) : <Text size="sm" c="dimmed">Sem check-ins neste período.</Text>}
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <Panel tone="sage" title="Hábitos cumpridos" icon="check" p="sm">
            <Group gap="sm" wrap="nowrap"><Ring value={d.habits.done} total={d.habits.scheduled} size={68} color="var(--mantine-color-sage-6)"><Text size="xs" fw={800}>{d.habits.rate === null ? "--" : `${d.habits.rate}%`}</Text></Ring><Text fw={800} fz={20} lh={1.1}>{d.habits.done} de {d.habits.scheduled}</Text></Group>
          </Panel>
          <Panel tone="sun" title="Leitura" icon="book2" p="sm">
            <Text fw={800} fz={28} lh={1}>{d.reading.pages}</Text><Text size="xs">páginas lidas · {d.reading.sessions} {d.reading.sessions === 1 ? "sessão" : "sessões"}</Text>
            {d.reading.finished.length > 0 && <Text size="xs" mt={4} fw={700}>Concluído: {d.reading.finished.join(", ")}</Text>}
          </Panel>
          <Panel tone="lavender" title="Atividades feitas" icon="star" p="sm">
            {d.activities.top.length === 0 ? <Text size="xs" style={{ opacity: 0.7 }}>Nenhuma registrada.</Text> : <Stack gap={4}>{d.activities.top.slice(0, 4).map((a) => <Group key={a.name} justify="space-between" wrap="nowrap"><Text size="sm">{a.name}</Text><Text size="xs" fw={800}>{a.count}x</Text></Group>)}</Stack>}
          </Panel>
          <Panel tone="plain" title="Tempo de uso" icon="mobile" p="sm">
            <Group gap="xs" wrap="nowrap"><Donut size={64} thickness={12} slices={[{ label: "Com tela", value: d.screen.com, color: "#e85d97" }, { label: "Sem tela", value: d.screen.sem, color: "#6c935e" }]} />
              <Stack gap={2}><Group gap={4}><Box w={8} h={8} style={{ borderRadius: 4, background: "#6c935e" }} /><Text size="xs">Sem tela {d.screen.sem} min</Text></Group><Group gap={4}><Box w={8} h={8} style={{ borderRadius: 4, background: "#e85d97" }} /><Text size="xs">Com tela {d.screen.com} min</Text></Group></Stack></Group>
            {screenTotal === 0 && <Text size="10px" c="dimmed" mt={4}>Baseado no que você registra.</Text>}
          </Panel>
        </SimpleGrid>

        <Panel tone="plain" title="Gastos por categoria" icon="wallet" action={<Text size="sm" fw={800}>{brl(d.spending.total)}</Text>}>
          <Stack gap={8}>
            {d.spending.byCategory.length === 0 && <Text size="sm" c="dimmed">Nenhum gasto no período.</Text>}
            {d.spending.byCategory.map((c) => (
              <div key={c.name}><Group justify="space-between" wrap="nowrap"><Text size="sm">{c.name}</Text><Text size="xs" fw={700}>{brl(c.total)}</Text></Group>
                <Box style={{ height: 8, borderRadius: 4, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}><Box style={{ width: `${(c.total / catMax) * 100}%`, height: "100%", background: CATEGORY_COLORS[c.color]?.hex ?? "#999", borderRadius: 4 }} /></Box></div>
            ))}
          </Stack>
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <Panel tone="sun" title="Melhor dia" icon="trophy" p="sm"><Text fw={800} fz={22}>{d.bestDay ? WEEKDAY_FULL[weekday(d.bestDay.date)] : "--"}</Text>{d.bestDay && <Text size="xs">{formatDateShort(d.bestDay.date)}</Text>}</Panel>
          <Panel tone="pink" title="Maior sequência" icon="flame" p="sm"><Text fw={800} fz={22}>{d.habits.bestStreak ? `${d.habits.bestStreak.days} ${d.habits.bestStreak.days === 1 ? "dia" : "dias"}` : "--"}</Text>{d.habits.bestStreak && <Text size="xs" lineClamp={1}>{d.habits.bestStreak.name}</Text>}</Panel>
        </SimpleGrid>
        {d.activities.mostFrequent && <Text size="sm" ta="center">Atividade mais frequente: <b>{d.activities.mostFrequent}</b></Text>}

        <Panel tone="lavender" title="O que ouvi, assisti, cozinhei e criei" icon="sparkles">
          <SimpleGrid cols={2} spacing="sm">
            <div><Text size="xs" fw={800} mb={2}>Ouvi</Text><List items={d.listened} empty="--" /></div>
            <div><Text size="xs" fw={800} mb={2}>Assisti</Text><List items={d.watched} empty="--" /></div>
            <div><Text size="xs" fw={800} mb={2}>Cozinhei</Text><List items={d.cooked} empty="--" /></div>
            <div><Text size="xs" fw={800} mb={2}>Criei</Text>{d.created.sessions > 0 ? <Text size="sm">{d.created.minutes} min em {d.created.sessions} {d.created.sessions === 1 ? "sessão" : "sessões"}</Text> : null}<List items={d.created.projects} empty={d.created.sessions ? "" : "--"} /></div>
          </SimpleGrid>
        </Panel>

        <Panel tone="plain" title={`Comparação com ${period === "semana" ? "a semana" : "o mês"} anterior`} icon="line">
          {p ? (<Stack gap={6}>
            <Compare label="Hábitos cumpridos" now={d.habits.rate ?? 0} before={p.habitsRate} fmt={(n) => `${n}%`} />
            <Compare label="Páginas lidas" now={d.reading.pages} before={p.pages} />
            <Compare label="Atividades feitas" now={d.activities.total} before={p.activities} />
            <Compare label="Gastos" now={d.spending.total} before={p.spending} fmt={brl} goodWhenUp={false} />
            {d.moodAvg !== null && <Compare label="Humor médio" now={d.moodAvg} before={p.moodAvg} />}
          </Stack>) : <Text size="sm" c="dimmed">Sem dados do período anterior para comparar.</Text>}
        </Panel>

        <Panel tone="pink" title={`Minha reflexão ${unit}`} icon="pencil"><ReflectionForm period={period} start={start} initial={reflection} /></Panel>

        {album.length > 0 && (
          <Panel tone="sage" title="Retrospectivas anteriores" icon="clock">
            <Stack gap={6}>{album.map((a) => (
              <Link key={`${a.period}${a.start_on}`} href={`/retrospectivas?p=${a.period}&d=${a.start_on}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Group justify="space-between" wrap="nowrap"><div><Text size="sm" fw={700}>{a.period === "semana" ? `Semana de ${formatDateShort(a.start_on)}` : cap(formatMonth(a.start_on))}</Text>{a.reflection && <Text size="xs" lineClamp={1} style={{ opacity: 0.75 }}>{a.reflection}</Text>}</div>{a.label && <Pill tone="sage">{a.label}</Pill>}</Group>
              </Link>))}</Stack>
          </Panel>
        )}
      </Stack>
    </>
  );
}
