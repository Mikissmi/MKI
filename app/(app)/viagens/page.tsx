import Link from "next/link";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { localDateKey } from "@/lib/time";
import { brl } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet } from "@/components/forms/FormSheet";
import { tripFields, tripStatusLabel, tripStatusTone, tripDates } from "@/lib/trips";
import { addTemplateItem, deletePackingItem, saveTrip, togglePacking } from "./actions";

export const metadata = { title: "Viagens" };

type Trip = { id: string; name: string; status: string; start_on: string | null; end_on: string | null; cover_url: string | null; estimated_cost_cents: number | null };

export default async function TripsPage() {
  const user = await requireUser();
  const today = localDateKey();
  const [trips, template] = await Promise.all([
    query<Trip>("SELECT id, name, status, start_on::text AS start_on, end_on::text AS end_on, cover_url, estimated_cost_cents FROM trips WHERE user_id = $1 ORDER BY start_on NULLS LAST, created_at DESC", [user.id]),
    query<{ id: string; title: string; checked: boolean }>("SELECT id, title, checked FROM packing_items WHERE user_id = $1 AND trip_id IS NULL ORDER BY created_at", [user.id]),
  ]);
  const next = trips.filter((t) => t.status === "planejado" && (!t.start_on || t.start_on >= today)).sort((a, b) => (a.start_on ?? "9").localeCompare(b.start_on ?? "9"))[0];
  const days = next ? await query<{ day_number: number; title: string }>("SELECT day_number, title FROM trip_days WHERE trip_id = $1 AND user_id = $2 ORDER BY day_number LIMIT 3", [next.id, user.id]) : [];
  const estimated = trips.filter((t) => t.status !== "visitado").reduce((a, t) => a + (t.estimated_cost_cents ?? 0), 0);

  return (
    <>
      <PageHeader title="Viagens" back="/mais" action={<AddSheet title="Nova viagem" fields={tripFields} values={{ status: "quero_ir" }} action={saveTrip} />} />
      <Stack gap="md">
        <Panel tone="plain">
          <Stack gap={6}>
            {trips.length === 0 && <Text size="sm" c="dimmed">Liste os lugares que você quer conhecer, planeje roteiros e guarde o diário depois de voltar.</Text>}
            {trips.map((t) => (
              <Link key={t.id} href={`/viagens/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Group gap="sm" wrap="nowrap" py={4}>
                  <Cover url={t.cover_url} icon="pin" width={44} height={44} radius={22} />
                  <Text fw={700} style={{ flex: 1 }}>{t.name}</Text>
                  <Pill tone={tripStatusTone(t.status)}>{tripStatusLabel(t.status)}</Pill><Icon name="right" size={18} />
                </Group>
              </Link>
            ))}
          </Stack>
        </Panel>

        {next && (
          <Link href={`/viagens/${next.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Panel tone="pink" title="Próxima viagem" icon="plane">
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <div style={{ flex: 1 }}><Text fw={800} fz={22} lh={1.1}>{next.name}</Text><Text size="sm" style={{ opacity: 0.9 }}>{tripDates(next.start_on, next.end_on)}</Text>
                  <Stack gap={4} mt="xs">{days.map((d) => <Group key={d.day_number} gap={8} wrap="nowrap"><Box w={10} h={10} style={{ borderRadius: 5, background: "var(--mantine-color-lotus-4)", flexShrink: 0 }} /><Text size="xs">Dia {d.day_number} · {d.title}</Text></Group>)}{days.length === 0 && <Text size="xs" style={{ opacity: 0.9 }}>Sem roteiro ainda.</Text>}</Stack></div>
                {next.cover_url && <Cover url={next.cover_url} width={110} height={110} radius={16} />}
              </Group>
            </Panel>
          </Link>
        )}

        <Panel tone="sage" title="Checklist de mala" icon="luggage">
          <Text size="xs" mb="xs" style={{ opacity: 0.9 }}>Modelo reaproveitável: em cada viagem você copia estes itens com um toque.</Text>
          <Stack gap={8}>
            {template.map((p) => (
              <Group key={p.id} gap={10} wrap="nowrap" justify="space-between">
                <form action={togglePacking} style={{ flex: 1 }}><input type="hidden" name="id" value={p.id} />
                  <button type="submit" aria-pressed={p.checked} style={{ display: "flex", gap: 10, alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", textAlign: "left" }}>
                    <span style={{ width: 22, height: 22, borderRadius: 7, border: "2px solid var(--mantine-color-sage-6)", background: p.checked ? "var(--mantine-color-sage-6)" : "transparent", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>{p.checked && <Icon name="check" size={14} stroke={3} />}</span>
                    <Text size="sm" td={p.checked ? "line-through" : undefined}>{p.title}</Text></button></form>
                <form action={deletePackingItem}><input type="hidden" name="id" value={p.id} /><Button type="submit" size="compact-xs" variant="subtle" color="dark" aria-label={`Remover ${p.title}`}><Icon name="x" size={14} /></Button></form>
              </Group>
            ))}
            <form action={addTemplateItem}><Group gap="xs" wrap="nowrap"><input name="title" placeholder="Adicionar ao modelo" aria-label="Novo item do modelo de mala" maxLength={80} style={{ flex: 1, height: 38, borderRadius: 19, border: "1px solid #cfe5ca", padding: "0 14px", background: "rgba(255,255,255,0.7)", color: "inherit" }} /><Button type="submit" size="compact-md" color="sage.7" aria-label="Adicionar">+</Button></Group></form>
          </Stack>
        </Panel>

        <Panel tone="sun" title="Custo estimado" icon="wallet"><Text fw={800} fz={26}>{brl(estimated)}</Text><Text size="xs" style={{ opacity: 0.9 }}>Soma das viagens que ainda não aconteceram.</Text></Panel>
      </Stack>
    </>
  );
}
