import { notFound } from "next/navigation";
import { z } from "zod";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ensureCategories } from "@/lib/finance";
import { localDateKey } from "@/lib/time";
import { brl, fmtDateKey, moneyInput } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill, ProgressBar } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { tripDates, tripFields, tripStatusLabel, tripStatusTone } from "@/lib/trips";
import { copyPackingTemplate, deleteDay, deletePackingItem, deleteTrip, deleteTripEntry, deleteTripExpense, saveDay, savePackingItem, saveTrip, saveTripEntry, saveTripExpense, togglePacking } from "../actions";

export const metadata = { title: "Viagem" };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const t = await queryOne<{ id: string; name: string; status: string; notes: string | null; link: string | null; estimated_cost_cents: number | null; start_on: string | null; end_on: string | null; cover_url: string | null }>(
    "SELECT id, name, status, notes, link, estimated_cost_cents, start_on::text AS start_on, end_on::text AS end_on, cover_url FROM trips WHERE id = $1 AND user_id = $2", [id.data, user.id]);
  if (!t) notFound();
  const [days, pack, expenses, diary, cats] = await Promise.all([
    query<{ id: string; day_number: number; title: string; notes: string | null }>("SELECT id, day_number, title, notes FROM trip_days WHERE trip_id = $1 AND user_id = $2 ORDER BY day_number", [t.id, user.id]),
    query<{ id: string; title: string; checked: boolean }>("SELECT id, title, checked FROM packing_items WHERE trip_id = $1 AND user_id = $2 ORDER BY created_at", [t.id, user.id]),
    query<{ id: string; date: string; amount_cents: number; note: string | null; category_id: string | null }>("SELECT id, date::text AS date, amount_cents, note, category_id FROM expenses WHERE trip_id = $1 AND user_id = $2 ORDER BY date DESC, created_at DESC", [t.id, user.id]),
    query<{ id: string; date: string; text: string | null; photo_url: string | null }>("SELECT id, date::text AS date, text, photo_url FROM trip_entries WHERE trip_id = $1 AND user_id = $2 ORDER BY date DESC, id", [t.id, user.id]),
    ensureCategories(user.id),
  ]);
  const spent = expenses.reduce((a, e) => a + e.amount_cents, 0);
  const today = localDateKey();
  const done = pack.filter((p) => p.checked).length;
  const dayFields: Field[] = [{ name: "day_number", label: "Dia nº", type: "decimal", required: true }, { name: "title", label: "O que fazer", required: true, maxLength: 120 }, { name: "notes", label: "Notas", type: "textarea" }];
  const packFields: Field[] = [{ name: "title", label: "Item", required: true, maxLength: 80 }];
  const expFields: Field[] = [
    { name: "amount_cents", label: "Valor (R$)", type: "decimal", required: true }, { name: "date", label: "Data", type: "date", required: true },
    { name: "category_id", label: "Categoria", type: "select", options: [{ value: "", label: "Sem categoria" }, ...cats.map((c) => ({ value: c.id, label: c.name }))] }, { name: "note", label: "Nota", maxLength: 160 },
  ];
  const diaryFields: Field[] = [{ name: "date", label: "Data", type: "date", required: true }, { name: "text", label: "O que aconteceu", type: "textarea" }, { name: "photo_url", label: "Link da foto", type: "url" }];
  const hid = { trip_id: t.id };

  return (
    <>
      <PageHeader title={t.name} back="/viagens" />
      <Stack gap="md">
        <Panel tone="pink">
          <Group wrap="nowrap" align="flex-start" gap="md">
            <Cover url={t.cover_url} icon="pin" width={96} height={96} radius={18} />
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6}><Pill tone={tripStatusTone(t.status)}>{tripStatusLabel(t.status)}</Pill></Group>
              <Text size="sm">{tripDates(t.start_on, t.end_on)}</Text>
              {t.estimated_cost_cents !== null && (<><Text size="xs">Estimado {brl(t.estimated_cost_cents)} · gasto {brl(spent)}</Text><ProgressBar value={t.estimated_cost_cents ? (spent / t.estimated_cost_cents) * 100 : 0} tone={spent <= t.estimated_cost_cents ? "sage" : "pink"} height={8} /></>)}
            </Stack>
          </Group>
          {t.notes && <Text size="sm" mt="sm" style={{ whiteSpace: "pre-wrap" }}>{t.notes}</Text>}
          <Group gap={6} mt="sm">
            <FormSheet title="Editar viagem" fields={tripFields} values={{ id: t.id, name: t.name, status: t.status, start_on: t.start_on, end_on: t.end_on, estimated_cost_cents: moneyInput(t.estimated_cost_cents), link: t.link, cover_url: t.cover_url, notes: t.notes }} action={saveTrip} remove={deleteTrip} block={false}><Button component="span" size="compact-sm" variant="white" color="gray">Editar</Button></FormSheet>
            {t.link && <Button component="a" href={t.link} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="white" color="gray" rightSection={<Icon name="external" size={12} />}>Link</Button>}
          </Group>
          <Text size="xs" mt={6} style={{ opacity: 0.7 }}>Excluir a viagem também exclui os gastos dela.</Text>
        </Panel>

        <Panel tone="lavender" title="Roteiro" icon="compass" action={<AddSheet title="Novo dia" fields={dayFields} values={{ day_number: String(days.length + 1) }} hidden={hid} action={saveDay} />}>
          <Stack gap={8}>
            {days.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Monte o roteiro dia a dia.</Text>}
            {days.map((d) => (
              <FormSheet key={d.id} title={`Dia ${d.day_number}`} fields={dayFields} values={{ id: d.id, day_number: d.day_number, title: d.title, notes: d.notes }} hidden={hid} action={saveDay} remove={deleteDay}>
                <Group gap={10} wrap="nowrap" align="flex-start"><Box style={{ width: 12, height: 12, borderRadius: 6, background: "var(--mantine-color-lotus-5)", marginTop: 5, flexShrink: 0 }} /><div><Text size="sm" fw={700}>Dia {d.day_number} · {d.title}</Text>{d.notes && <Text size="xs" style={{ opacity: 0.75 }}>{d.notes}</Text>}</div></Group>
              </FormSheet>
            ))}
          </Stack>
        </Panel>

        <Panel tone="sage" title={`Mala (${done}/${pack.length})`} icon="luggage" action={<AddSheet title="Novo item" fields={packFields} hidden={hid} action={savePackingItem} />}>
          <Stack gap={8}>
            {pack.length === 0 && (<form action={copyPackingTemplate}><input type="hidden" name="trip_id" value={t.id} /><Button type="submit" size="compact-sm" variant="white" color="sage.8">Copiar o modelo de mala</Button></form>)}
            {pack.map((p) => (
              <Group key={p.id} gap={10} wrap="nowrap" justify="space-between">
                <form action={togglePacking} style={{ flex: 1 }}><input type="hidden" name="id" value={p.id} />
                  <button type="submit" aria-pressed={p.checked} style={{ display: "flex", gap: 10, alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", textAlign: "left" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, border: "2px solid var(--mantine-color-sage-6)", background: p.checked ? "var(--mantine-color-sage-6)" : "transparent", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>{p.checked && <Icon name="check" size={14} stroke={3} />}</span>
                    <Text size="sm" td={p.checked ? "line-through" : undefined}>{p.title}</Text></button></form>
                <form action={deletePackingItem}><input type="hidden" name="id" value={p.id} /><Button type="submit" size="compact-xs" variant="subtle" color="gray" aria-label={`Remover ${p.title}`}><Icon name="x" size={14} /></Button></form>
              </Group>
            ))}
            {pack.length > 0 && <form action={copyPackingTemplate}><input type="hidden" name="trip_id" value={t.id} /><Button type="submit" size="compact-xs" variant="subtle" color="sage.8">Adicionar itens do modelo que faltam</Button></form>}
          </Stack>
        </Panel>

        <Panel tone="sun" title={`Gastos da viagem · ${brl(spent)}`} icon="wallet" action={<AddSheet title="Novo gasto da viagem" fields={expFields} values={{ date: today, category_id: "" }} hidden={hid} action={saveTripExpense} />}>
          <Text size="xs" mb="xs" style={{ opacity: 0.8 }}>Ficam separados dos gastos do dia a dia em Finanças.</Text>
          <Stack gap={8}>
            {expenses.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Nenhum gasto registrado.</Text>}
            {expenses.map((e) => (
              <FormSheet key={e.id} title="Editar gasto" fields={expFields} values={{ id: e.id, amount_cents: moneyInput(e.amount_cents), date: e.date, category_id: e.category_id ?? "", note: e.note }} hidden={hid} action={saveTripExpense} remove={deleteTripExpense}>
                <Group justify="space-between" wrap="nowrap"><div><Text size="sm" fw={700}>{e.note || "Gasto"}</Text><Text size="xs" style={{ opacity: 0.75 }}>{fmtDateKey(e.date)}</Text></div><Text size="sm" fw={800}>{brl(e.amount_cents)}</Text></Group>
              </FormSheet>
            ))}
          </Stack>
        </Panel>

        <Panel tone="plain" title="Diário da viagem" icon="notebook" action={<AddSheet title="Nova entrada" fields={diaryFields} values={{ date: today }} hidden={hid} action={saveTripEntry} />}>
          <Stack gap="sm">
            {diary.length === 0 && <Text size="sm" c="dimmed">Depois de voltar, conte como foi e guarde fotos (por link).</Text>}
            {diary.map((d) => (
              <FormSheet key={d.id} title="Editar entrada" fields={diaryFields} values={{ id: d.id, date: d.date, text: d.text, photo_url: d.photo_url }} hidden={hid} action={saveTripEntry} remove={deleteTripEntry}>
                <Group wrap="nowrap" align="flex-start" gap="sm">{d.photo_url && <Cover url={d.photo_url} width={64} height={64} radius={12} />}<div><Text size="xs" c="dimmed">{fmtDateKey(d.date)}</Text>{d.text && <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{d.text}</Text>}</div></Group>
              </FormSheet>
            ))}
          </Stack>
        </Panel>
      </Stack>
    </>
  );
}
