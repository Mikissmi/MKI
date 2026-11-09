import { Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { ensureCategories } from "@/lib/finance";
import { addDays, addMonths, cap, formatMonth, isDateKey, localDateKey, startOfMonth, startOfWeek } from "@/lib/time";
import { brl, fmtDateKey, moneyInput } from "@/lib/format";
import { CATEGORY_COLORS } from "@/lib/options";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { Logo } from "@/components/Logo";
import { Panel, IconTile, Pill, ProgressBar } from "@/components/ui/Panel";
import { Donut } from "@/components/ui/charts";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteExpense, saveBudget, saveExpense } from "./actions";

export const metadata = { title: "Finanças" };

type Exp = { id: string; date: string; amount_cents: number; note: string | null; category_id: string | null };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ m?: string; c?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const today = localDateKey();
  const month = startOfMonth(sp.m && isDateKey(`${sp.m}-01`) ? `${sp.m}-01` : today);
  const next = addMonths(month, 1);
  const [categories, settings] = await Promise.all([ensureCategories(user.id), getSettings(user.id)]);
  const catId = categories.find((c) => c.id === sp.c)?.id ?? "";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const cat = (id: string | null) => categories.find((c) => c.id === id);

  const [byCat, dayTotal, weekTotal, list, trips] = await Promise.all([
    query<{ category_id: string | null; total: string }>("SELECT category_id, sum(amount_cents)::text AS total FROM expenses WHERE user_id = $1 AND trip_id IS NULL AND date >= $2::date AND date < $3::date GROUP BY category_id", [user.id, month, next]),
    queryOne<{ s: string | null }>("SELECT sum(amount_cents)::text AS s FROM expenses WHERE user_id = $1 AND trip_id IS NULL AND date = $2::date", [user.id, today]),
    queryOne<{ s: string | null }>("SELECT sum(amount_cents)::text AS s FROM expenses WHERE user_id = $1 AND trip_id IS NULL AND date BETWEEN $2::date AND $3::date", [user.id, startOfWeek(today), addDays(startOfWeek(today), 6)]),
    query<Exp>(
      `SELECT id, date::text AS date, amount_cents, note, category_id FROM expenses
        WHERE user_id = $1 AND trip_id IS NULL AND date >= $2::date AND date < $3::date AND ($4 = '' OR category_id::text = $4) AND ($5 = '' OR note ILIKE '%' || $5 || '%')
        ORDER BY date DESC, created_at DESC LIMIT 200`, [user.id, month, next, catId, q]),
    queryOne<{ s: string | null }>("SELECT sum(amount_cents)::text AS s FROM expenses WHERE user_id = $1 AND trip_id IS NOT NULL AND date >= $2::date AND date < $3::date", [user.id, month, next]),
  ]);
  const monthTotal = byCat.reduce((a, r) => a + Number(r.total), 0);
  const budget = settings.monthlyBudgetCents;
  const catOptions = [{ value: "", label: "Sem categoria" }, ...categories.map((c) => ({ value: c.id, label: c.name }))];
  const fields: Field[] = [
    { name: "amount_cents", label: "Valor (R$)", type: "decimal", required: true, placeholder: "12,50" }, { name: "date", label: "Data", type: "date", required: true },
    { name: "category_id", label: "Categoria", type: "select", options: catOptions }, { name: "note", label: "Nota", maxLength: 160, placeholder: "Mercado, ônibus..." },
  ];
  const slices = categories.map((c) => ({ label: c.name, value: Number(byCat.find((b) => b.category_id === c.id)?.total ?? 0), color: CATEGORY_COLORS[c.color]?.hex ?? "#999" }));
  const uncategorized = Number(byCat.find((b) => b.category_id === null)?.total ?? 0);
  if (uncategorized) slices.push({ label: "Sem categoria", value: uncategorized, color: "#bbb" });
  const mq = (m: string) => `/financas?m=${m.slice(0, 7)}${catId ? `&c=${catId}` : ""}`;

  return (
    <>
      <PageHeader title="Finanças" back="/mais" action={<AddSheet title="Novo gasto" label="Novo gasto" fields={fields} values={{ date: today, category_id: "" }} action={saveExpense} />} />
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <LinkButton href={mq(addMonths(month, -1))} variant="subtle" size="compact-md" aria-label="Mês anterior">‹</LinkButton>
          <Text fw={800}>{cap(formatMonth(month))}</Text>
          <LinkButton href={mq(next)} variant="subtle" size="compact-md" aria-label="Próximo mês">›</LinkButton>
        </Group>

        <Panel tone="plain">
          <Text size="sm" c="dimmed">Total do mês</Text>
          <Text fw={800} fz={32} lh={1.1}>{brl(monthTotal)}</Text>
          {budget ? (<Stack gap={4} mt={6}>
            <ProgressBar value={(monthTotal / budget) * 100} tone={monthTotal <= budget ? "sage" : "pink"} height={8} />
            <Group justify="space-between"><Pill tone={monthTotal <= budget ? "sage" : "pink"} icon={monthTotal <= budget ? "check" : "flag"}>{monthTotal <= budget ? "dentro do planejado" : "acima do planejado"}</Pill><Text size="xs" c="dimmed">de {brl(budget)}</Text></Group>
          </Stack>) : null}
          <Group mt="sm" gap="xs">
            <FormSheet title="Orçamento do mês" fields={[{ name: "budget", label: "Quanto planejo gastar por mês (R$)", type: "decimal", description: "Deixe vazio para não usar orçamento." }]} values={{ budget: moneyInput(budget) }} action={saveBudget} block={false}>
              <Button component="span" size="compact-xs" variant="light" color="gray" leftSection={<Icon name="target" size={12} />}>{budget ? "Alterar orçamento" : "Definir orçamento"}</Button>
            </FormSheet>
          </Group>
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <Panel tone="sun" p="sm"><Text size="xs">Hoje</Text><Text fw={800} fz={20}>{brl(Number(dayTotal?.s ?? 0))}</Text></Panel>
          <Panel tone="lavender" p="sm"><Text size="xs">Esta semana</Text><Text fw={800} fz={20}>{brl(Number(weekTotal?.s ?? 0))}</Text></Panel>
        </SimpleGrid>

        <Panel tone="plain" title="Por categoria" icon="chart" action={<LinkButton href="/financas/categorias" size="compact-xs" variant="light">Editar categorias</LinkButton>}>
          <Group wrap="nowrap" gap="md" align="center">
            <Donut slices={slices} size={150} thickness={26} center={<Logo size={44} />} />
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
              {slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value).map((s) => (
                <Group key={s.label} gap={6} wrap="nowrap" justify="space-between"><Group gap={6} wrap="nowrap"><Box w={10} h={10} style={{ borderRadius: 5, background: s.color, flexShrink: 0 }} /><Text size="xs" truncate>{s.label}</Text></Group><Text size="xs" fw={800}>{brl(s.value)}</Text></Group>
              ))}
              {monthTotal === 0 && <Text size="xs" c="dimmed">Nenhum gasto neste mês.</Text>}
            </Stack>
          </Group>
        </Panel>

        <Group gap={6} wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
          <LinkButton href={`/financas?m=${month.slice(0, 7)}`} size="compact-sm" style={{ flexShrink: 0 }} variant={catId === "" ? "filled" : "light"}>Todas</LinkButton>
          {categories.map((c) => <LinkButton key={c.id} href={`/financas?m=${month.slice(0, 7)}&c=${c.id}`} size="compact-sm" style={{ flexShrink: 0 }} variant={catId === c.id ? "filled" : "light"} leftSection={<Icon name={c.icon} size={13} />}>{c.name}</LinkButton>)}
        </Group>
        <form action="/financas" method="get"><input type="hidden" name="m" value={month.slice(0, 7)} />{catId && <input type="hidden" name="c" value={catId} />}
          <Group gap="xs" wrap="nowrap"><input name="q" defaultValue={q} placeholder="Buscar pela nota" aria-label="Buscar gastos" style={{ flex: 1, height: 40, borderRadius: 20, border: "1px solid #ecd9cf", padding: "0 14px", background: "var(--mantine-color-body)", color: "inherit" }} /><Button type="submit" variant="light" size="compact-md" aria-label="Buscar"><Icon name="search" size={16} /></Button></Group></form>

        <Panel tone="plain" title="Lançamentos" icon="receipt">
          <Stack gap={8}>
            {list.length === 0 && <Text size="sm" c="dimmed">Nenhum lançamento{catId || q ? " com esse filtro" : " neste mês"}.</Text>}
            {list.map((e) => {
              const c = cat(e.category_id);
              return (
                <FormSheet key={e.id} title="Editar gasto" fields={fields} values={{ id: e.id, amount_cents: moneyInput(e.amount_cents), date: e.date, category_id: e.category_id ?? "", note: e.note }} action={saveExpense} remove={deleteExpense}>
                  <Group wrap="nowrap" gap="sm">
                    <IconTile icon={c?.icon ?? "wallet"} tone="pink" size={38} round />
                    <div style={{ flex: 1, minWidth: 0 }}><Text size="sm" fw={700} truncate>{e.note || c?.name || "Gasto"}</Text><Text size="xs" c="dimmed">{fmtDateKey(e.date)}{c ? ` · ${c.name}` : ""}</Text></div>
                    <Text size="sm" fw={800}>- {brl(e.amount_cents)}</Text>
                  </Group>
                </FormSheet>
              );
            })}
          </Stack>
        </Panel>
        {Number(trips?.s ?? 0) > 0 && <Text size="xs" c="dimmed" ta="center">Gastos de viagem deste mês ({brl(Number(trips?.s))}) ficam separados, em Viagens.</Text>}
      </Stack>
    </>
  );
}
