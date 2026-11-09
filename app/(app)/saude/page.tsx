import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { addDays, cap, localDateKey, parseTime, weekday } from "@/lib/time";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, IconTile, ProgressBar } from "@/components/ui/Panel";
import { LineChart } from "@/components/ui/charts";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { MEALS, WORKOUTS } from "@/lib/options";
import { addWater, deleteMeal, deleteWorkout, saveMeal, saveMeasure, saveSleep, saveWorkout } from "./actions";

export const metadata = { title: "Saúde e bem-estar" };

const DAY = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
const sleepMinutes = (s: string, w: string) => (((parseTime(w) ?? 0) - (parseTime(s) ?? 0)) + 1440) % 1440;
const t5 = (t: string) => t.slice(0, 5);

export default async function HealthPage() {
  const user = await requireUser();
  const today = localDateKey();
  const from = addDays(today, -6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const settings = await getSettings(user.id);

  const [checkins, sleeps, waterWeek, meals, workouts, workWeek, stepsWeek, measure] = await Promise.all([
    query<{ date: string; mood: number; energy: number }>("SELECT date::text AS date, mood, energy FROM checkins WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [user.id, from, today]),
    query<{ id: string; date: string; slept_at: string; woke_at: string; quality: number | null }>("SELECT id, date::text AS date, slept_at::text AS slept_at, woke_at::text AS woke_at, quality FROM sleep_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [user.id, from, today]),
    query<{ date: string; glasses: number }>("SELECT date::text AS date, glasses FROM water_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [user.id, from, today]),
    query<{ id: string; meal: string; description: string }>("SELECT id, meal, description FROM meal_logs WHERE user_id = $1 AND date = $2::date ORDER BY created_at", [user.id, today]),
    query<{ id: string; kind: string; duration_min: number }>("SELECT id, kind, duration_min FROM workout_logs WHERE user_id = $1 AND date = $2::date ORDER BY created_at", [user.id, today]),
    queryOne<{ n: string; m: string | null }>("SELECT count(*)::text AS n, sum(duration_min)::text AS m FROM workout_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [user.id, from, today]),
    queryOne<{ s: string | null }>("SELECT avg(steps)::int::text AS s FROM body_measures WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date AND steps IS NOT NULL", [user.id, from, today]),
    queryOne<{ weight_kg: string | null; waist_cm: string | null; hip_cm: string | null; steps: number | null; date: string }>("SELECT date::text AS date, weight_kg, waist_cm, hip_cm, steps FROM body_measures WHERE user_id = $1 ORDER BY date DESC LIMIT 1", [user.id]),
  ]);

  const moodBy = new Map(checkins.map((c) => [c.date, c]));
  const water = waterWeek.find((w) => w.date === today)?.glasses ?? 0;
  const lastSleep = sleeps.filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0];
  const sleepAvg = sleeps.length ? Math.round(sleeps.reduce((a, s) => a + sleepMinutes(s.slept_at, s.woke_at), 0) / sleeps.length) : null;
  const waterAvg = Math.round((waterWeek.reduce((a, w) => a + w.glasses, 0) / 7) * 10) / 10;
  const goal = settings.waterGoal;

  const sleepFields: Field[] = [
    { name: "slept_at", label: "Dormiu às", type: "time", required: true }, { name: "woke_at", label: "Acordou às", type: "time", required: true },
    { name: "quality", label: "Qualidade do sono (1 a 5)", type: "decimal", placeholder: "4" },
  ];
  const workoutFields: Field[] = [
    { name: "kind", label: "Tipo", type: "select", options: WORKOUTS.map((w) => ({ value: w, label: w })) },
    { name: "duration_min", label: "Duração (minutos)", type: "decimal", required: true },
  ];
  const measureFields: Field[] = [
    { name: "weight_kg", label: "Peso (kg)", type: "decimal", placeholder: "62,5" }, { name: "waist_cm", label: "Cintura (cm)", type: "decimal" },
    { name: "hip_cm", label: "Quadril (cm)", type: "decimal" }, { name: "steps", label: "Passos do dia", type: "decimal" },
  ];
  const mealFields: Field[] = [{ name: "description", label: "O que você comeu", required: true, maxLength: 200 }];
  const m = measure;

  return (
    <>
      <PageHeader title="Saúde e bem-estar" back="/mais" />
      <Stack gap="md">
        <Panel tone="pink" title="Humor e energia da semana" icon="mood-4">
          <LineChart labels={days.map((d) => DAY[weekday(d)])} series={[
            { name: "Humor", color: "#e85d97", points: days.map((d) => moodBy.get(d)?.mood ?? null) },
            { name: "Energia", color: "#6c935e", points: days.map((d) => moodBy.get(d)?.energy ?? null) },
          ]} min={1} max={5} />
          <Group gap="md" justify="center"><Group gap={4}><Box w={10} h={10} style={{ borderRadius: 5, background: "#e85d97" }} /><Text size="xs">Humor</Text></Group><Group gap={4}><Box w={10} h={10} style={{ borderRadius: 5, background: "#6c935e" }} /><Text size="xs">Energia</Text></Group></Group>
          {checkins.length === 0 && <Text size="xs" mt="xs" c="dimmed" ta="center">Faça o check-in na tela Hoje para ver o gráfico.</Text>}
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <FormSheet title="Sono de hoje" fields={sleepFields} values={{ id: lastSleep?.date === today ? lastSleep.id : undefined, slept_at: lastSleep ? t5(lastSleep.slept_at) : "23:00", woke_at: lastSleep ? t5(lastSleep.woke_at) : "07:00", quality: lastSleep?.quality }} hidden={{ date: today }} action={saveSleep}>
            <Panel tone="lavender" title="Sono" icon="moon" p="sm" style={{ height: "100%" }}>
              {lastSleep ? (<>
                <Group grow gap={4}><div><Text size="10px" style={{ opacity: 0.7 }}>Dormiu</Text><Text fw={800}>{t5(lastSleep.slept_at)}</Text></div><div><Text size="10px" style={{ opacity: 0.7 }}>Acordou</Text><Text fw={800}>{t5(lastSleep.woke_at)}</Text></div></Group>
                <Text fw={800} fz={22} mt={6}>{hm(sleepMinutes(lastSleep.slept_at, lastSleep.woke_at))}</Text>
              </>) : <Text size="sm" mt="xs">Toque para registrar o sono.</Text>}
            </Panel>
          </FormSheet>
          <Panel tone="sage" title="Água" icon="droplet" p="sm">
            <Text size="sm" fw={800}>{water} de {goal} copos</Text>
            <Group gap={3} my={6} wrap="wrap">{Array.from({ length: goal }, (_, i) => <Icon key={i} name="glass" size={16} color={i < water ? "var(--mantine-color-sage-7)" : "var(--mantine-color-sage-3)"} />)}</Group>
            <ProgressBar value={(water / goal) * 100} tone="sage" height={8} />
            <Group gap={6} mt={8} grow>
              <form action={addWater}><input type="hidden" name="delta" value="-1" /><button type="submit" aria-label="Tirar um copo" style={btn}>−</button></form>
              <form action={addWater}><input type="hidden" name="delta" value="1" /><button type="submit" aria-label="Adicionar um copo" style={{ ...btn, background: "var(--mantine-color-sage-6)", color: "#fff" }}>+ copo</button></form>
            </Group>
          </Panel>
        </SimpleGrid>

        <Panel tone="sun" title="Refeições do dia" icon="kitchen">
          <SimpleGrid cols={3} spacing="xs">
            {MEALS.slice(0, 3).map((ml) => (
              <AddSheet key={ml.value} label={ml.value === "cafe" ? "Café" : ml.label} title={ml.label} fields={mealFields} hidden={{ date: today, meal: ml.value }} action={saveMeal} />
            ))}
          </SimpleGrid>
          <Group gap={6} mt={6}><AddSheet label="Lanche" title="Lanche" fields={mealFields} hidden={{ date: today, meal: "lanche" }} action={saveMeal} /></Group>
          <Stack gap={6} mt="xs">
            {MEALS.flatMap((ml) => meals.filter((x) => x.meal === ml.value).map((x) => (
              <FormSheet key={x.id} title={ml.label} fields={mealFields} values={{ id: x.id, description: x.description }} hidden={{ date: today, meal: ml.value }} action={saveMeal} remove={deleteMeal}>
                <Group gap="xs" wrap="nowrap"><Text size="xs" fw={800} w={92} style={{ flexShrink: 0 }}>{ml.label}</Text><Text size="sm" truncate>{x.description}</Text></Group>
              </FormSheet>
            )))}
            {meals.length === 0 && <Text size="xs" style={{ opacity: 0.8 }}>Nada registrado hoje. Toque em uma refeição para anotar.</Text>}
          </Stack>
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <Panel tone="sage" title="Exercício" icon="run" p="sm" action={<AddSheet label="" title="Novo treino" fields={workoutFields} values={{ kind: "Caminhada", duration_min: "30" }} hidden={{ date: today }} action={saveWorkout} />}>
            <Stack gap={6}>
              {workouts.length === 0 && <Text size="xs" style={{ opacity: 0.8 }}>Nenhum treino hoje.</Text>}
              {workouts.map((w) => (
                <FormSheet key={w.id} title="Editar treino" fields={workoutFields} values={{ id: w.id, kind: w.kind, duration_min: w.duration_min }} hidden={{ date: today }} action={saveWorkout} remove={deleteWorkout}>
                  <Group gap={6} wrap="nowrap"><IconTile icon="walk" tone="sage" size={26} round /><Text size="sm" fw={700}>{w.kind} · {w.duration_min} min</Text></Group>
                </FormSheet>
              ))}
            </Stack>
          </Panel>
          <FormSheet title="Medidas" fields={measureFields} values={{ weight_kg: m?.weight_kg?.replace(".", ","), waist_cm: m?.waist_cm?.replace(".", ","), hip_cm: m?.hip_cm?.replace(".", ","), steps: m?.steps }} hidden={{ date: today }} action={saveMeasure}>
            <Panel tone="lavender" title="Medidas" icon="scale" p="sm" style={{ height: "100%" }}>
              <SimpleGrid cols={2} spacing={4}>
                {[["Peso", m?.weight_kg ? `${m.weight_kg} kg` : "--"], ["Cintura", m?.waist_cm ? `${m.waist_cm} cm` : "--"], ["Quadril", m?.hip_cm ? `${m.hip_cm} cm` : "--"], ["Passos", m?.steps ? String(m.steps) : "--"]].map(([k, v]) => (
                  <div key={k}><Text size="10px" style={{ opacity: 0.7 }}>{k}</Text><Text size="sm" fw={800}>{v}</Text></div>
                ))}
              </SimpleGrid>
            </Panel>
          </FormSheet>
        </SimpleGrid>

        <Panel tone="plain" title="Semana em resumo" icon="chart">
          <SimpleGrid cols={2} spacing="xs">
            <div><Text size="xs" c="dimmed">Sono médio</Text><Text fw={800}>{sleepAvg === null ? "--" : hm(sleepAvg)}</Text></div>
            <div><Text size="xs" c="dimmed">Água média por dia</Text><Text fw={800}>{waterAvg} copos</Text></div>
            <div><Text size="xs" c="dimmed">Treinos</Text><Text fw={800}>{workWeek?.n ?? 0}{workWeek?.m ? ` · ${workWeek.m} min` : ""}</Text></div>
            <div><Text size="xs" c="dimmed">Passos (média)</Text><Text fw={800}>{stepsWeek?.s ?? "--"}</Text></div>
          </SimpleGrid>
        </Panel>
      </Stack>
      <Text size="xs" c="dimmed" ta="center" mt="md">{cap("os dados de saúde ficam fora da IA, a menos que você libere em Configurações")}.</Text>
    </>
  );
}

const btn = { width: "100%", border: "none", borderRadius: 12, padding: "6px 0", background: "rgba(255,255,255,0.7)", fontWeight: 800, cursor: "pointer", color: "inherit" } as const;
