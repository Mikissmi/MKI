import { Button, Group, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { addDays, cap, formatDateShort, isDateKey, localDateKey, startOfWeek } from "@/lib/time";
import { MEALS } from "@/lib/options";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { Panel } from "@/components/ui/Panel";
import { FormSheet, type Field } from "@/components/forms/FormSheet";
import { savePlan, weekToShopping } from "../actions";

export const metadata = { title: "Planejar semana" };

export default async function WeekPlanPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const user = await requireUser();
  const today = localDateKey();
  const sp = await searchParams;
  const start = startOfWeek(isDateKey(sp.w) ? sp.w : today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [recipes, plans] = await Promise.all([
    query<{ id: string; title: string }>("SELECT id, title FROM recipes WHERE user_id = $1 ORDER BY title", [user.id]),
    query<{ date: string; meal: string; recipe_id: string | null; custom: string | null; title: string | null }>(
      "SELECT m.date::text AS date, m.meal, m.recipe_id, m.custom, r.title FROM meal_plans m LEFT JOIN recipes r ON r.id = m.recipe_id WHERE m.user_id = $1 AND m.date BETWEEN $2::date AND $3::date", [user.id, start, addDays(start, 6)]),
  ]);
  const fields: Field[] = [
    { name: "recipe_id", label: "Receita", type: "select", options: [{ value: "", label: "Nenhuma" }, ...recipes.map((r) => ({ value: r.id, label: r.title }))] },
    { name: "custom", label: "Ou escreva o que vai comer", maxLength: 120, description: "Deixe os dois vazios para limpar a refeição." },
  ];
  return (
    <>
      <PageHeader title="Planejar semana" back="/receitas" />
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <LinkButton href={`/receitas/semana?w=${addDays(start, -7)}`} variant="subtle" size="compact-md" aria-label="Semana anterior">‹</LinkButton>
          <Text fw={800}>{cap(formatDateShort(start))} a {formatDateShort(addDays(start, 6))}</Text>
          <LinkButton href={`/receitas/semana?w=${addDays(start, 7)}`} variant="subtle" size="compact-md" aria-label="Próxima semana">›</LinkButton>
        </Group>
        {days.map((d) => (
          <Panel key={d} tone={d === today ? "pink" : "plain"} title={cap(formatDateShort(d))} p="sm">
            <Stack gap={6}>
              {MEALS.slice(0, 3).map((ml) => {
                const p = plans.find((x) => x.date === d && x.meal === ml.value);
                return (
                  <FormSheet key={ml.value} title={`${ml.label} · ${formatDateShort(d)}`} fields={fields} values={{ recipe_id: p?.recipe_id ?? "", custom: p?.custom }} hidden={{ date: d, meal: ml.value }} action={savePlan} submitLabel="Salvar">
                    <Group gap="xs" wrap="nowrap"><Text size="xs" fw={800} w={92} style={{ flexShrink: 0 }}>{ml.label}</Text><Text size="sm" c={p ? undefined : "dimmed"} truncate>{p ? (p.title ?? p.custom) : "+ planejar"}</Text></Group>
                  </FormSheet>
                );
              })}
            </Stack>
          </Panel>
        ))}
        <form action={weekToShopping}><input type="hidden" name="week" value={start} /><Button type="submit" fullWidth size="md">Gerar lista de compras da semana</Button></form>
        <Text size="xs" c="dimmed" ta="center">A lista junta os ingredientes das receitas planejadas, sem repetir itens que já estão na lista.</Text>
      </Stack>
    </>
  );
}
