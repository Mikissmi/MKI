import { Box, Button, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fetchCheckin, fetchOccurrences } from "@/lib/agenda/queries";
import { freeSlots } from "@/lib/agenda/free-slots";
import { isScheduled } from "@/lib/habits";
import { ensureDayPlan, getPlanState, aiUsageToday } from "@/lib/planner/service";
import { AI_DAILY_LIMIT } from "@/lib/settings";
import { formatDateLong, localDateKey, localMinutes, cap } from "@/lib/time";
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

export default async function TodayPage() {
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

  const taken = [...ctx.busy, ...blocks.map((b) => ({ startMin: b.start_min, endMin: b.start_min + b.duration_min }))];
  const slots = freeSlots(taken, Math.max(ctx.wake, nowMin), ctx.sleep);
  const hasProposed = blocks.some((b) => b.status === "proposed");
  const rulesMode = mode.source === "rules" && mode.reason && mode.reason !== "manual";
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
        <CheckinCard initial={checkin ? { mood: checkin.mood, energy: checkin.energy, note: checkin.note } : null} />

        {ctx.lightDay && (
          <Panel tone="lavender" title="Dia leve" icon="leaf" action={<form action={toggleLightDay}><Button type="submit" size="compact-xs" variant="white" color="lavender.7">{state.lightDay ? "Voltar ao normal" : "Desligar"}</Button></form>}>
            <Text size="sm">Seu plano encolheu para 2 ou 3 itens fáceis e gostosos. Hábitos ficam pausados, sem atraso e sem sequência quebrada.</Text>
          </Panel>
        )}

        <Panel
          tone="plain" title="Plano do dia" icon="calendar"
          action={<Group gap={6}>
            {!ctx.lightDay && <form action={toggleLightDay}><Button type="submit" size="compact-xs" variant="light" color="lavender.7" leftSection={<Icon name="leaf" size={12} />}>Dia leve</Button></form>}
            <LinkButton href="/agenda/evento/novo" size="compact-xs" variant="light">Evento</LinkButton>
          </Group>}
        >
          {rulesMode && <Box mb="sm" title={MODE_TEXT[mode.reason!] ?? ""}><Pill tone="lavender" icon="lock">modo regras</Pill>{" "}<Text component="span" size="xs" c="dimmed">{MODE_TEXT[mode.reason!]}</Text></Box>}
          {autoLoad ? <PlanAutoLoader /> : <PlanTimeline occurrences={occurrences} blocks={blocks} freeSlots={slots} nowMin={nowMin} lightDay={ctx.lightDay} />}
          <Group gap="xs" mt="sm">
            {hasProposed && <form action={acceptAllBlocks}><Button type="submit" size="compact-sm">Aceitar todas</Button></form>}
            {stale && <form action={refreshPlan}><Button type="submit" size="compact-sm" variant="light" leftSection={<Icon name="refresh" size={14} />}>Atualizar plano</Button></form>}
          </Group>
          {usage >= AI_DAILY_LIMIT - 2 && usage < AI_DAILY_LIMIT && <Text size="xs" c="dimmed" mt="xs">Você usou {usage} de {AI_DAILY_LIMIT} chamadas de IA hoje.</Text>}
        </Panel>

        <SimpleGrid cols={3} spacing="xs">
          <StatTile tone="sage" icon="leaf" label="Hábitos" value={`${habitDone?.n ?? 0}/${habitsToday}`} />
          <StatTile tone="lavender" icon="droplet" label="Água" value={`${water?.glasses ?? 0} ${(water?.glasses ?? 0) === 1 ? "copo" : "copos"}`} />
          <StatTile tone="sun" icon="wallet" label="Gasto do dia" value={brl(spent)} />
        </SimpleGrid>
      </Stack>
    </>
  );
}

/** Total gasto hoje (sem gastos de viagem). Antes de existir a tabela de gastos devolve 0. */
async function expenseTotalToday(userId: string, today: string): Promise<number> {
  try {
    const row = await queryOne<{ s: string | null }>("SELECT sum(amount_cents)::text AS s FROM expenses WHERE user_id = $1 AND date = $2::date AND trip_id IS NULL", [userId, today]);
    return Number(row?.s ?? 0);
  } catch { return 0; }
}
