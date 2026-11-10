import Link from "next/link";
import { Box, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fetchCheckin, fetchOccurrences } from "@/lib/agenda/queries";
import { freeSlots } from "@/lib/agenda/free-slots";
import { isScheduled } from "@/lib/habits";
import { ensureDayPlan, getPlanState, aiUsageToday, lastAiFailure } from "@/lib/planner/service";
import { aiFailureText } from "@/lib/ai/messages";
import { pendingRetro } from "@/lib/retro";
import { loadTrilha } from "@/lib/trilha";
import { welcomeDue } from "@/lib/presence";
import { focusFor, getClosing } from "@/lib/closing";
import { memoryForToday } from "@/lib/memory";
import { MemoryCard, MorningSummary, PrioritiesCard, WelcomeBack } from "@/components/PresenceCards";
import { Cover } from "@/components/ui/Cover";
import { AI_DAILY_LIMIT } from "@/lib/settings";
import { addDays, formatDateLong, localDateKey, localMinutes, cap } from "@/lib/time";
import { brl } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { Logo } from "@/components/Logo";
import { LinkButton, LinkIconButton } from "@/components/LinkButton";
import { CheckinCard } from "@/components/agenda/CheckinCard";
import { PlanAutoLoader } from "@/components/PlanAutoLoader";
import { PlanTimeline, type BlockRow } from "@/components/PlanTimeline";
import { Panel, Pill, StatTile } from "@/components/ui/Panel";
import { refreshPlan, toggleLightDay, acceptAllBlocks } from "./plan-actions";

function greeting(min: number) {
  if (min < 12 * 60) return "Bom dia";
  if (min < 18 * 60) return "Boa tarde";
  return "Boa noite";
}

const MODE_TEXT: Record<string, string> = {
  disabled: "A IA está desligada em Configurações.", no_key: "A IA ainda não foi configurada (falta a chave do Gemini).", limit: "O limite diário de chamadas à IA foi atingido.",
  cooldown: "A IA falhou há pouco; o app espera alguns minutos antes de tentar de novo.", failed: "A IA falhou desta vez.", format: "A resposta da IA veio fora do formato.",
};

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ checkin?: string; resumo?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const now = new Date();
  const today = localDateKey(now);
  const nowMin = localMinutes(now);

  let state = await getPlanState(user.id, today, today);
  let mode: { source: string; reason: string | null } = { source: state.source ?? "rules", reason: state.reason };
  let autoLoad = false;
  if (!state.exists) {
    if (state.ai.ok) autoLoad = true; // o cliente pede o plano à IA e atualiza a tela
    else { const r = await ensureDayPlan(user.id, today, { today }); mode = { source: r.source === "cache" ? "rules" : r.source, reason: r.reason }; state = await getPlanState(user.id, today, today); }
  } else if (state.stale && !state.ai.ok) {
    const r = await ensureDayPlan(user.id, today, { today });
    mode = { source: r.source === "cache" ? "rules" : r.source, reason: r.reason }; state = await getPlanState(user.id, today, today);
  }
  const stale = state.stale && state.ai.ok;
  const { ctx, settings } = state.loaded;

  const [occurrences, checkin, blocks, habitRows, habitDone, water, usage] = await Promise.all([
    fetchOccurrences(user.id, today, today),
    fetchCheckin(user.id, today),
    query<BlockRow>("SELECT id, start_min, duration_min, kind, title, reason, status, screen_type FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND status IN ('proposed','accepted') ORDER BY start_min", [user.id, today]),
    query<{ id: string; frequency: "daily" | "weekdays" | "times_per_week"; weekdays: number[] }>("SELECT id, frequency, weekdays FROM habits WHERE user_id = $1 AND NOT archived", [user.id]),
    queryOne<{ n: string }>("SELECT count(*)::text AS n FROM habit_logs WHERE user_id = $1 AND date = $2::date", [user.id, today]),
    queryOne<{ glasses: number }>("SELECT glasses FROM water_logs WHERE user_id = $1 AND date = $2::date", [user.id, today]),
    aiUsageToday(user.id, today),
  ]);
  const habitsToday = habitRows.filter((h) => isScheduled({ id: h.id, frequency: h.frequency, weekdays: h.weekdays, timesPerWeek: null }, today)).length;
  const spent = await expenseTotalToday(user.id, today);
  const retro = settings.retroNotice ? await pendingRetro(user.id, today) : null;
  const headlines = await query<{ id: string; title: string; feed_title: string }>(
    "SELECT n.id, n.title, f.title AS feed_title FROM news_items n JOIN feeds f ON f.id = n.feed_id AND NOT f.muted WHERE n.user_id = $1 AND NOT n.read ORDER BY n.published_at DESC NULLS LAST, n.created_at DESC LIMIT 3", [user.id]);

  // propostas de "ajuste" (mover o início de um bloco) não ocupam tempo livre; o resto das sugestões ocupa
  const taken = [...ctx.busy, ...blocks.filter((b) => b.kind !== "ajuste").map((b) => ({ startMin: b.start_min, endMin: b.start_min + b.duration_min }))];
  const slots = freeSlots(taken, Math.max(ctx.wake, nowMin), ctx.sleep);
  const hasProposed = blocks.some((b) => b.status === "proposed");
  const rulesMode = mode.source === "rules" && mode.reason && mode.reason !== "manual";
  const failure = rulesMode && ["failed", "format", "cooldown"].includes(mode.reason!) ? await lastAiFailure(user.id) : null;
  const { trilha } = await loadTrilha(user.id, today);
  const welcome = welcomeDue(settings, today);
  // de manhã por padrão; /?resumo=1 abre o resumo a qualquer hora
  const morning = !welcome && (sp.resumo === "1" || (settings.morningSummary && nowMin < 12 * 60));
  const [yClosing, memory, focus] = await Promise.all([
    getClosing(user.id, addDays(today, -1)),
    settings.memoryCard && !welcome ? memoryForToday(user.id, today) : Promise.resolve(null),
    morning ? focusFor(user.id, today) : Promise.resolve(null),
  ]);
  const summaryItems = morning ? [
    ...occurrences.filter((o) => !o.canceled && o.endMin > nowMin).map((o) => ({ startMin: o.startMin, title: o.title })),
    ...blocks.filter((b) => b.kind !== "ajuste" && b.start_min + b.duration_min > nowMin).map((b) => ({ startMin: b.start_min, title: b.title })),
  ].sort((a, b) => a.startMin - b.startMin).slice(0, 4) : [];
  const name = settings.displayName ?? user.username;

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <Box>
          <Logo size={34} />
          <Title order={1} fz={26} mt={4}>{greeting(nowMin)}, {cap(name)}</Title>
          <Text c="dimmed" size="sm">{cap(formatDateLong(today))}</Text>
        </Box>
        <LinkIconButton href="/assistente" size={42} radius="xl" variant="light" color="lotus" aria-label="Assistente"><Icon name="robot" size={22} /></LinkIconButton>
      </Group>

      <Stack gap="md">
        {welcome && <WelcomeBack />}
        {morning && <MorningSummary focus={focus} items={summaryItems} news={headlines.slice(0, 2).map((h) => ({ id: h.id, title: h.title, feed: h.feed_title }))} />}
        {yClosing && yClosing.priorities.length > 0 && <PrioritiesCard priorities={yClosing.priorities} />}
        <CheckinCard initial={checkin ? { mood: checkin.mood, energy: checkin.energy, note: checkin.note } : null} startOpen={sp.checkin === "1"} />

        {ctx.lightDay && (
          <Panel tone="lavender" title="Dia leve" icon="leaf" action={<form action={toggleLightDay}><Button type="submit" size="compact-xs" variant="white" color="lavender.7">{state.lightDay ? "Voltar ao normal" : "Desligar"}</Button></form>}>
            <Text size="sm">Seu plano encolheu para 2 ou 3 itens fáceis e gostosos. Hábitos ficam pausados, sem atraso e sem sequência quebrada.</Text>
          </Panel>
        )}

        <Panel
          tone="plain" title="Plano do dia" icon="calendar"
          action={<Group gap={6}>
            {!ctx.lightDay && <form action={toggleLightDay}><Button type="submit" size="compact-xs" variant="light" color="lavender" leftSection={<Icon name="leaf" size={12} />}>Dia leve</Button></form>}
            <LinkButton href="/agenda/evento/novo" size="compact-xs" variant="light">Evento</LinkButton>
          </Group>}
        >
          {rulesMode && <Box mb="sm" title={MODE_TEXT[mode.reason!] ?? ""}><Pill tone="lavender" icon="lock">modo regras</Pill>{" "}<Text component="span" size="xs" c="dimmed">{failure ? aiFailureText(failure.reason, failure.detail) : MODE_TEXT[mode.reason!]}</Text></Box>}
          {autoLoad ? <PlanAutoLoader /> : <PlanTimeline occurrences={occurrences} blocks={blocks} freeSlots={slots} nowMin={nowMin} lightDay={ctx.lightDay} />}
          <Group gap="xs" mt="sm">
            {hasProposed && <form action={acceptAllBlocks}><Button type="submit" size="compact-sm">Aceitar todas</Button></form>}
            {stale && <form action={refreshPlan}><Button type="submit" size="compact-sm" variant="light" leftSection={<Icon name="refresh" size={14} />}>Atualizar plano</Button></form>}
          </Group>
          {usage >= AI_DAILY_LIMIT - 2 && usage < AI_DAILY_LIMIT && <Text size="xs" c="dimmed" mt="xs">Você usou {usage} de {AI_DAILY_LIMIT} chamadas de IA hoje.</Text>}
        </Panel>

        {settings.screenBreakReminder && ctx.screenMinutes.com >= 120 && (
          <Panel tone="sage" title="Que tal uma pausa sem tela?" icon="leaf">
            <Text size="sm">Você já registrou {Math.round(ctx.screenMinutes.com / 60 * 10) / 10} h com tela hoje. Alongue, olhe pela janela ou beba água.</Text>
          </Panel>
        )}

        {retro && (
          <Panel tone="sun" title={retro.period === "semana" ? "Sua retrospectiva da semana está pronta" : "Sua retrospectiva do mês está pronta"} icon="calendar" action={<LinkButton href={`/retrospectivas?p=${retro.period}&d=${retro.start}`} size="compact-xs">Ver</LinkButton>}>
            <Text size="sm" style={{ opacity: 0.85 }}>Veja como foi: humor, hábitos, leituras, tempo de tela e gastos.</Text>
          </Panel>
        )}

        {trilha && (
          <Panel tone="pink" title="Trilha do dia" icon="music" action={<LinkButton href="/musica" size="compact-xs" variant="subtle">Música</LinkButton>}>
            <Group wrap="nowrap" gap="sm">
              <Cover url={trilha.cover_url} icon="music" width={56} height={56} radius={14} />
              <div style={{ flex: 1, minWidth: 0 }}><Text fw={800} lineClamp={1}>{trilha.title}</Text>{trilha.subtitle && <Text size="xs" lineClamp={1} style={{ opacity: 0.9 }}>{trilha.subtitle}</Text>}</div>
              {trilha.url && <Button component="a" href={trilha.url} target="_blank" rel="noopener noreferrer" size="compact-sm" leftSection={<Icon name="play" size={14} />} aria-label={trilha.spotify_playlist_id ? `Abrir no Spotify: ${trilha.title}` : `Abrir ${trilha.title} no app de música`}>{trilha.spotify_playlist_id ? "Abrir no Spotify" : "Abrir"}</Button>}
            </Group>
          </Panel>
        )}

        {memory && <MemoryCard item={memory} />}

        {headlines.length > 0 && !morning && (
          <Panel tone="plain" title="Notícias em destaque" icon="news" action={<LinkButton href="/noticias" size="compact-xs" variant="subtle">Ver todas</LinkButton>}>
            <Stack gap={8}>{headlines.map((h) => (<Link key={h.id} href={`/noticias/${h.id}`} style={{ textDecoration: "none", color: "inherit" }}><Text size="xs" c="dimmed">{h.feed_title}</Text><Text size="sm" fw={700} lh={1.25}>{h.title}</Text></Link>))}</Stack>
          </Panel>
        )}

        <SimpleGrid cols={3} spacing="xs">
          <StatTile tone="sage" icon="leaf" label="Hábitos" value={`${habitDone?.n ?? 0}/${habitsToday}`} />
          <StatTile tone="lavender" icon="droplet" label="Água" value={`${water?.glasses ?? 0} ${(water?.glasses ?? 0) === 1 ? "copo" : "copos"}`} />
          <StatTile tone="sun" icon="wallet" label="Gasto do dia" value={brl(spent)} />
        </SimpleGrid>
      </Stack>
    </>
  );
}

/** Total gasto hoje (sem gastos de viagem, que ficam separados). */
async function expenseTotalToday(userId: string, today: string): Promise<number> {
  const row = await queryOne<{ s: string | null }>("SELECT sum(amount_cents)::text AS s FROM expenses WHERE user_id = $1 AND date = $2::date AND trip_id IS NULL", [userId, today]);
  return Number(row?.s ?? 0);
}
