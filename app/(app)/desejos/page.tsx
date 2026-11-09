import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ensureCategories } from "@/lib/finance";
import { localDateKey } from "@/lib/time";
import { brl, moneyInput } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteWish, markBought, markReceived, saveWish } from "./actions";

export const metadata = { title: "Lista de desejos" };

type Wish = { id: string; name: string; price_cents: number | null; url: string | null; photo_url: string | null; priority: string; category: string | null; status: string; wait_days: number; days_left: number };
const PRIO = { alta: { label: "Prioridade alta", color: "#e0457b" }, media: { label: "Prioridade média", color: "#8a62c2" }, baixa: { label: "Prioridade baixa", color: "#6c935e" } } as const;

export default async function WishlistPage() {
  const user = await requireUser();
  const today = localDateKey();
  const [items, cats] = await Promise.all([
    query<Wish>(
      `SELECT id, name, price_cents, url, photo_url, priority, category, status, wait_days, (release_on - $2::date) AS days_left FROM wishlist_items WHERE user_id = $1
        ORDER BY (status IN ('comprei','ganhei')), CASE priority WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, created_at DESC`, [user.id, today]),
    ensureCategories(user.id),
  ]);
  const pending = items.filter((i) => i.status === "quero" || i.status === "esperando");
  const total = pending.reduce((a, i) => a + (i.price_cents ?? 0), 0);
  const fields: Field[] = [
    { name: "name", label: "O que você quer", required: true, maxLength: 120 }, { name: "price_cents", label: "Preço (R$)", type: "decimal", placeholder: "399,00" },
    { name: "priority", label: "Prioridade", type: "select", options: [{ value: "alta", label: "Alta" }, { value: "media", label: "Média" }, { value: "baixa", label: "Baixa" }] },
    { name: "status", label: "Status", type: "select", options: [{ value: "quero", label: "Quero" }, { value: "esperando", label: "Esperando" }, { value: "comprei", label: "Comprei" }, { value: "ganhei", label: "Ganhei" }] },
    { name: "wait_days", label: "Dias de espera antes de liberar a compra", type: "decimal", description: "Ajuda a evitar compras por impulso. Conta a partir de quando você cadastrou." },
    { name: "category", label: "Categoria", maxLength: 40 }, { name: "url", label: "Link da loja", type: "url" }, { name: "photo_url", label: "Link da foto", type: "url" },
  ];
  const buyFields: Field[] = [
    { name: "launch_expense", label: "Lançar o gasto em Finanças", type: "switch" },
    { name: "category_id", label: "Categoria do gasto", type: "select", options: [{ value: "", label: "Sem categoria" }, ...cats.map((c) => ({ value: c.id, label: c.name }))] },
    { name: "override", label: "Comprar mesmo antes do prazo de espera", type: "switch" },
  ];

  return (
    <>
      <PageHeader title="Lista de desejos" back="/mais" action={<AddSheet title="Novo desejo" fields={fields} values={{ priority: "media", status: "quero", wait_days: "30" }} action={saveWish} />} />
      <Stack gap="md">
        <Panel tone="pink">
          <Group gap="sm" wrap="nowrap"><Box style={{ width: 52, height: 52, borderRadius: 26, display: "grid", placeItems: "center", background: "light-dark(#f8c6d4, rgba(232,93,151,0.35))" }}><Icon name="heart" size={26} /></Box>
            <div><Text size="sm">Total dos desejos pendentes</Text><Text fw={800} fz={28} lh={1.1}>{brl(total)}</Text></div></Group>
        </Panel>
        {items.length === 0 && <Text size="sm" c="dimmed">Anote o que você quer comprar. O período de espera ajuda a decidir com calma.</Text>}
        {items.map((w) => {
          const effective = w.status === "quero" && w.days_left > 0 ? "esperando" : w.status;
          const pillTone = effective === "quero" ? "pink" : effective === "esperando" ? "lavender" : "sage";
          const pillIcon = effective === "quero" ? "heart" : effective === "esperando" ? "hourglass" : "check";
          const prio = PRIO[w.priority as keyof typeof PRIO] ?? PRIO.media;
          const released = w.days_left <= 0;
          return (
            <Panel key={w.id} tone="plain" p="sm">
              <FormSheet title="Editar desejo" fields={fields} values={{ id: w.id, name: w.name, price_cents: moneyInput(w.price_cents), priority: w.priority, status: w.status, wait_days: w.wait_days, category: w.category, url: w.url, photo_url: w.photo_url }} action={saveWish} remove={deleteWish}>
                <Group wrap="nowrap" gap="sm" align="flex-start">
                  <Cover url={w.photo_url} icon="gift" width={92} height={92} radius={16} />
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" wrap="nowrap" align="flex-start"><Text fw={800} lh={1.2}>{w.name}</Text><Pill tone={pillTone} icon={pillIcon}>{effective === "quero" ? "Quero" : effective === "esperando" ? "Esperando" : effective === "comprei" ? "Comprei" : "Ganhei"}</Pill></Group>
                    {w.price_cents !== null && <Text fw={800} fz={18}>{brl(w.price_cents)}</Text>}
                    <Group gap={5}><Icon name="flag" size={13} color={prio.color} /><Text size="xs" fw={600}>{prio.label}</Text></Group>
                    {(w.status === "quero" || w.status === "esperando") && <Group gap={5}><Icon name="calendar" size={13} /><Text size="xs" c="dimmed">{released ? "liberado para compra" : `libera em ${w.days_left} ${w.days_left === 1 ? "dia" : "dias"}`}</Text></Group>}
                  </Stack>
                </Group>
              </FormSheet>
              {(w.status === "quero" || w.status === "esperando") && (
                <Group gap={6} mt="xs">
                  <FormSheet title={`Comprei: ${w.name}`} fields={buyFields} values={{ launch_expense: true, category_id: "", override: false }} hidden={{ id: w.id }} action={markBought} submitLabel="Confirmar compra" block={false}>
                    <Button component="span" size="compact-xs" color={released ? "sage.7" : "gray"} variant={released ? "filled" : "light"} leftSection={<Icon name={released ? "check" : "lock"} size={12} />}>Comprei</Button>
                  </FormSheet>
                  <form action={markReceived}><input type="hidden" name="id" value={w.id} /><Button type="submit" size="compact-xs" variant="light" color="lotus" leftSection={<Icon name="gift" size={12} />}>Ganhei</Button></form>
                  {w.url && <Button component="a" href={w.url} target="_blank" rel="noopener noreferrer" size="compact-xs" variant="subtle" color="dark" rightSection={<Icon name="external" size={12} />}>Loja</Button>}
                </Group>
              )}
            </Panel>
          );
        })}
      </Stack>
    </>
  );
}
