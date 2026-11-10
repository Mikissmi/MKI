import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { isScheduled, streak, doneInWeek, type HabitDef } from "@/lib/habits";
import { addDays, addMonths, cap, formatMonth, isDateKey, localDateKey, startOfMonth, startOfWeek } from "@/lib/time";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { Panel, IconTile, Pill } from "@/components/ui/Panel";
import { Ring } from "@/components/ui/charts";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { HABIT_ICONS } from "@/lib/options";
import { deleteHabit, deleteQuickWin, saveHabit, saveQuickWin, toggleHabit } from "./actions";

export const metadata = { title: "Hábitos" };

type HabitRow = { id: string; name: string; icon: string; frequency: HabitDef["frequency"]; weekdays: number[]; times_per_week: number | null; routine: "manha" | "noite" | null };

const ICON_LABEL: Record<string, string> = { droplet: "Gota", yoga: "Alongar", book: "Livro", palette: "Arte", moon: "Lua", run: "Corrida", apple: "Fruta", heart: "Coração", sun: "Sol", leaf: "Folha", music: "Música", notebook: "Caderno", check: "Check" };
const habitFields: Field[] = [
  { name: "name", label: "Nome do hábito", required: true, maxLength: 80, placeholder: "Ex.: Beber água" },
  { name: "icon", label: "Ícone", type: "select", options: HABIT_ICONS.map((i) => ({ value: i, label: ICON_LABEL[i] })) },
  { name: "frequency", label: "Frequência", type: "select", options: [{ value: "daily", label: "Todo dia" }, { value: "weekdays", label: "Dias da semana" }, { value: "times_per_week", label: "X vezes por semana" }] },
  { name: "weekdays", label: "Dias (se for por dias da semana)", type: "days" },
  { name: "times_per_week", label: "Vezes por semana (se for X vezes)", type: "decimal", placeholder: "3" },
  { name: "routine", label: "Rotina guiada", type: "select", options: [{ value: "", label: "Nenhuma" }, { value: "manha", label: "Rotina da manhã" }, { value: "noite", label: "Rotina da noite" }] },
];
const winFields: Field[] = [
  { name: "title", label: "Mini-vitória", required: true, maxLength: 100, placeholder: "Ex.: Alongar 10 min" },
  { name: "duration_min", label: "Duração (minutos, de 1 a 30)", type: "decimal", required: true },
  { name: "energy", label: "Energia necessária", type: "select", options: [{ value: "baixa", label: "Baixa" }, { value: "media", label: "Média" }, { value: "alta", label: "Alta" }] },
  { name: "screen_type", label: "Tela", type: "select", options: [{ value: "sem_tela", label: "Sem tela" }, { value: "com_tela", label: "Com tela" }] },
];

function CheckButton({ habitId, date, done }: { habitId: string; date: string; done: boolean }) {
  return (
    <form action={toggleHabit}>
      <input type="hidden" name="habit_id" value={habitId} /><input type="hidden" name="date" value={date} />
      <button type="submit" aria-label={done ? "Desmarcar" : "Marcar como feito"} aria-pressed={done}
        style={{ width: 28, height: 28, borderRadius: 9, border: `2px solid ${done ? "var(--mantine-color-lotus-5)" : "var(--mantine-color-lotus-3)"}`, background: done ? "var(--mantine-color-lotus-5)" : "transparent", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
        {done && <Icon name="check" size={18} stroke={3} />}
      </button>
    </form>
  );
}

export default async function HabitsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = localDateKey();
  const month = startOfMonth(sp.m && isDateKey(`${sp.m}-01`) ? `${sp.m}-01` : today);
  const since = addDays(today, -400);

  const [habits, logs, wins, paused] = await Promise.all([
    query<HabitRow>("SELECT id, name, icon, frequency, weekdays, times_per_week, routine FROM habits WHERE user_id = $1 AND NOT archived ORDER BY created_at", [user.id]),
    query<{ habit_id: string; date: string }>("SELECT habit_id, date::text AS date FROM habit_logs WHERE user_id = $1 AND date >= $2::date", [user.id, since]),
    query<{ id: string; title: string; duration_min: number; energy: string; screen_type: string }>("SELECT id, title, duration_min, energy, screen_type FROM quick_wins WHERE user_id = $1 ORDER BY created_at", [user.id]),
    query<{ d: string }>("SELECT date::text AS d FROM checkins WHERE user_id = $1 AND energy <= 2 AND date >= $2::date UNION SELECT date::text FROM paused_days WHERE user_id = $1 AND date >= $2::date UNION SELECT date::text FROM day_plans WHERE user_id = $1 AND light_day AND date >= $2::date", [user.id, since]),
  ]);
  const pausedDays = new Set(paused.map((p) => p.d));
  const lightToday = pausedDays.has(today);
  const logsBy = new Map<string, Set<string>>();
  for (const l of logs) logsBy.set(l.habit_id, (logsBy.get(l.habit_id) ?? new Set()).add(l.date));
  const def = (h: HabitRow): HabitDef => ({ id: h.id, frequency: h.frequency, weekdays: h.weekdays, timesPerWeek: h.times_per_week });
  const logOf = (h: HabitRow) => logsBy.get(h.id) ?? new Set<string>();

  const todays = habits.filter((h) => isScheduled(def(h), today));
  const doneToday = todays.filter((h) => logOf(h).has(today)).length;

  // taxa de conclusão: dias programados (fora do Dia leve) com registro
  const rate = (days: number) => {
    let sched = 0, done = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(today, -i);
      if (pausedDays.has(d)) continue;
      for (const h of habits) if (isScheduled(def(h), d)) { sched++; if (logOf(h).has(d)) done++; }
    }
    return sched ? Math.round((done / sched) * 100) : null;
  };
  const week = rate(7), mon = rate(30);

  // calendário de calor do mês
  const gridStart = startOfWeek(month);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)).filter((d, i) => i < 35 || d.slice(0, 7) === month.slice(0, 7));
  const ratioOf = (d: string) => {
    if (d > today) return null;
    let sched = 0, done = 0;
    for (const h of habits) if (isScheduled(def(h), d)) { sched++; if (logOf(h).has(d)) done++; }
    return sched ? done / sched : null;
  };

  const rowOf = (h: HabitRow) => {
    const done = logOf(h).has(today);
    const s = streak(def(h), logOf(h), today, pausedDays);
    const goal = h.frequency === "times_per_week" ? ` · ${doneInWeek(logOf(h), today)}/${h.times_per_week} na semana` : "";
    return (
      <Group key={h.id} wrap="nowrap" gap="sm">
        <CheckButton habitId={h.id} date={today} done={done} />
        <FormSheet title="Editar hábito" fields={habitFields} values={{ id: h.id, name: h.name, icon: h.icon, frequency: h.frequency, weekdays: h.weekdays.map(String), times_per_week: h.times_per_week, routine: h.routine ?? "" }} action={saveHabit} remove={deleteHabit}>
          <Group gap="xs" wrap="nowrap"><IconTile icon={h.icon} tone="pink" size={30} round /><div><Text size="sm" fw={700} lh={1.2}>{h.name}</Text>{goal && <Text size="xs" c="dimmed">{goal.slice(3)}</Text>}</div></Group>
        </FormSheet>
        <Box ml="auto">{s > 0 && <Pill tone="pink" icon="flame">{s} {s === 1 ? "dia" : "dias"}</Pill>}</Box>
      </Group>
    );
  };

  const plain = todays.filter((h) => !h.routine);
  const routines = (["manha", "noite"] as const).map((r) => ({ r, list: todays.filter((h) => h.routine === r) })).filter((x) => x.list.length > 0);
  const notToday = habits.filter((h) => !isScheduled(def(h), today));

  return (
    <>
      <PageHeader title="Hábitos" back="/mais" action={<AddSheet title="Novo hábito" fields={habitFields} values={{ icon: "check", frequency: "daily", weekdays: [] }} action={saveHabit} />} />
      <Stack gap="md">
        <Panel tone="pink">
          <Group wrap="nowrap" gap="md" align="center">
            <Ring value={doneToday} total={todays.length}>
              <div><Text fw={800} fz={26} lh={1}>{doneToday}/{todays.length}</Text><Text size="10px" lh={1.1}>hábitos<br />cumpridos<br />hoje</Text></div>
            </Ring>
            <Stack gap={8} style={{ flex: 1, minWidth: 0 }}>
              {plain.length === 0 && <Text size="sm" c="dimmed">{habits.length === 0 ? "Crie seu primeiro hábito no botão Novo." : "Nenhum hábito avulso hoje."}</Text>}
              {plain.map(rowOf)}
            </Stack>
          </Group>
          {lightToday && <Text size="xs" mt="sm" c="dimmed">Dia leve: hábitos pausados, sem atraso e sem sequência quebrada.</Text>}
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <Panel tone="sage" p="sm"><Text size="xs">Taxa da semana</Text><Text fw={800} fz={24}>{week === null ? "--" : `${week}%`}</Text></Panel>
          <Panel tone="lavender" p="sm"><Text size="xs">Taxa do mês</Text><Text fw={800} fz={24}>{mon === null ? "--" : `${mon}%`}</Text></Panel>
        </SimpleGrid>

        <Panel tone="plain" title="Calendário de calor" icon="calendar">
          <Group justify="space-between" mb="xs" wrap="nowrap">
            <LinkButton href={`/habitos?m=${addMonths(month, -1).slice(0, 7)}`} size="compact-sm" variant="subtle" aria-label="Mês anterior">‹</LinkButton>
            <Text size="sm" fw={800}>{cap(formatMonth(month))}</Text>
            <LinkButton href={`/habitos?m=${addMonths(month, 1).slice(0, 7)}`} size="compact-sm" variant="subtle" aria-label="Próximo mês">›</LinkButton>
          </Group>
          <SimpleGrid cols={7} spacing={4}>
            {["D", "S", "T", "Q", "Q", "S", "S"].map((w, i) => <Text key={i} size="xs" ta="center" c="dimmed" fw={700}>{w}</Text>)}
            {cells.map((d) => {
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              const r = ratioOf(d);
              const bg = !inMonth ? "transparent" : r === null ? "light-dark(#f6efe3, rgba(255,255,255,0.05))" : r === 0 ? "light-dark(#f6efe3, rgba(255,255,255,0.05))" : r < 0.5 ? "#fbd5df" : r < 1 ? "#f395bc" : "#c2a9e8";
              return <Box key={d} title={d} style={{ aspectRatio: "1", borderRadius: 8, background: bg, display: "grid", placeItems: "center", opacity: inMonth ? 1 : 0.2, outline: d === today ? "2px solid var(--mantine-color-lotus-5)" : undefined }}><Text size="10px" c={r !== null && r >= 0.5 ? "white" : "dimmed"}>{Number(d.slice(8))}</Text></Box>;
            })}
          </SimpleGrid>
          <Text size="xs" c="dimmed" mt="xs">Cor mais forte = mais hábitos cumpridos no dia.</Text>
        </Panel>

        {routines.map(({ r, list }) => (
          <Panel key={r} tone="sage" title={r === "manha" ? "Rotina da manhã" : "Rotina da noite"} icon={r === "manha" ? "sunrise" : "moon"}>
            <Stack gap={8}>{list.map(rowOf)}</Stack>
          </Panel>
        ))}

        {notToday.length > 0 && (
          <Panel tone="plain" title="Não é hoje" icon="clock">
            <Stack gap={8}>{notToday.map((h) => (
              <FormSheet key={h.id} title="Editar hábito" fields={habitFields} values={{ id: h.id, name: h.name, icon: h.icon, frequency: h.frequency, weekdays: h.weekdays.map(String), times_per_week: h.times_per_week, routine: h.routine ?? "" }} action={saveHabit} remove={deleteHabit}>
                <Group gap="xs"><IconTile icon={h.icon} tone="plain" size={28} round /><Text size="sm" c="dimmed">{h.name}</Text></Group>
              </FormSheet>))}</Stack>
          </Panel>
        )}

        <Panel tone="lavender" title="Mini-vitórias do Dia leve" icon="sparkles" action={<AddSheet title="Nova mini-vitória" fields={winFields} values={{ duration_min: "10", energy: "baixa", screen_type: "sem_tela" }} action={saveQuickWin} />}>
          <Text size="xs" mb="xs" style={{ opacity: 0.9 }}>Coisas de 5 a 10 minutos para os dias de pouca energia.</Text>
          <Stack gap={6}>
            {wins.length === 0 && <Text size="sm" c="dimmed">Cadastre, por exemplo: alongar, ler uma página, ouvir um álbum, rabiscar.</Text>}
            {wins.map((w) => (
              <FormSheet key={w.id} title="Editar mini-vitória" fields={winFields} values={{ id: w.id, title: w.title, duration_min: w.duration_min, energy: w.energy, screen_type: w.screen_type }} action={saveQuickWin} remove={deleteQuickWin}>
                <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={600}>{w.title}</Text><Text size="xs" c="dimmed">{w.duration_min} min · {w.screen_type === "sem_tela" ? "sem tela" : "com tela"}</Text></Group>
              </FormSheet>
            ))}
          </Stack>
        </Panel>
      </Stack>
    </>
  );
}
