import { Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { Panel } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet } from "@/components/forms/FormSheet";
import { recipeFields } from "@/lib/recipes";
import { addShoppingItem, clearChecked, saveRecipe, toggleShopping } from "./actions";

export const metadata = { title: "Receitas" };
const FILTERS = [{ f: "", label: "Todas" }, { f: "rapidas", label: "Rápidas" }, { f: "saudaveis", label: "Saudáveis" }, { f: "doces", label: "Doces" }];

export default async function RecipesPage({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = FILTERS.find((x) => x.f === sp.f)?.f ?? "";
  const q = (sp.q ?? "").trim().slice(0, 60);
  const [recipes, shopping] = await Promise.all([
    query<{ id: string; title: string; minutes: number | null; rating: string | null; photo_url: string | null }>(
      `SELECT id, title, minutes, rating, photo_url FROM recipes WHERE user_id = $1
         AND ($2 <> 'rapidas' OR minutes <= 30) AND ($2 <> 'saudaveis' OR tags && ARRAY['saudável','saudavel','fit']) AND ($2 <> 'doces' OR tags && ARRAY['doce','doces','sobremesa'])
         AND ($3 = '' OR title ILIKE '%' || $3 || '%' OR array_to_string(tags, ' ') ILIKE '%' || $3 || '%' OR ingredients ILIKE '%' || $3 || '%')
       ORDER BY created_at DESC`, [user.id, f, q]),
    query<{ id: string; title: string; checked: boolean }>("SELECT id, title, checked FROM shopping_items WHERE user_id = $1 ORDER BY checked, created_at", [user.id]),
  ]);
  return (
    <>
      <PageHeader title="Receitas" back="/mais" action={<AddSheet title="Nova receita" fields={recipeFields} action={saveRecipe} />} />
      <Stack gap="md">
        <form action="/receitas" method="get">{f && <input type="hidden" name="f" value={f} />}
          <Group gap="xs" wrap="nowrap"><input name="q" defaultValue={q} placeholder="Buscar receitas" aria-label="Buscar receitas" style={{ flex: 1, height: 42, borderRadius: 21, border: "1px solid #ecd9cf", padding: "0 16px", background: "var(--mantine-color-body)", color: "inherit" }} /><Button type="submit" variant="light" size="compact-md" aria-label="Buscar"><Icon name="search" size={16} /></Button></Group></form>
        <Group gap={6} wrap="nowrap" style={{ overflowX: "auto" }}>{FILTERS.map((x) => <LinkButton key={x.f} href={`/receitas${x.f ? `?f=${x.f}` : ""}`} size="compact-sm" style={{ flexShrink: 0 }} variant={f === x.f ? "filled" : "white"}>{x.label}</LinkButton>)}</Group>

        {recipes.length === 0 ? <Text size="sm" c="dimmed">{q || f ? "Nenhuma receita com esse filtro." : "Salve suas receitas: ingredientes, passos, tempo, foto (por link) e nota. Dá para guardar também o link de uma receita da internet."}</Text> : (
          <SimpleGrid cols={3} spacing="xs">
            {recipes.map((r) => (
              <Link key={r.id} href={`/receitas/${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Box p={6} style={{ background: "light-dark(#fffdf8, var(--mantine-color-dark-6))", border: "1px solid light-dark(#f0e4d2, var(--mantine-color-dark-4))", borderRadius: 18, height: "100%" }}>
                  <Cover url={r.photo_url} icon="chef" tone="sun" width={92} height={92} radius={12} />
                  <Text size="xs" fw={800} lh={1.2} mt={4} lineClamp={2}>{r.title}</Text>
                  <Group gap={4} mt={2} wrap="nowrap">{r.minutes && <><Icon name="clock" size={11} /><Text size="10px">{r.minutes} min</Text></>}{r.rating && <><Icon name="star-filled" size={11} color="#f2c534" /><Text size="10px">{Number(r.rating).toFixed(1).replace(".", ",")}</Text></>}</Group>
                </Box>
              </Link>
            ))}
          </SimpleGrid>
        )}

        <LinkButton href="/receitas/semana" size="md" leftSection={<Icon name="calendar" size={18} />}>Planejar semana</LinkButton>

        <Panel tone="sage" title="Lista de compras" icon="cart" action={shopping.some((s) => s.checked) ? <form action={clearChecked}><Button type="submit" size="compact-xs" variant="white" color="gray">Limpar marcados</Button></form> : undefined}>
          <Stack gap={8}>
            {shopping.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Vazia. Adicione itens ou envie os ingredientes de uma receita.</Text>}
            {shopping.map((s) => (
              <form key={s.id} action={toggleShopping}><input type="hidden" name="id" value={s.id} />
                <button type="submit" aria-pressed={s.checked} style={{ display: "flex", gap: 10, alignItems: "center", background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", width: "100%", textAlign: "left" }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, border: "2px solid var(--mantine-color-sage-6)", background: s.checked ? "var(--mantine-color-sage-6)" : "transparent", display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}>{s.checked && <Icon name="check" size={14} stroke={3} />}</span>
                  <Text size="sm" td={s.checked ? "line-through" : undefined} style={{ opacity: s.checked ? 0.6 : 1 }}>{s.title}</Text>
                </button>
              </form>
            ))}
            <form action={addShoppingItem}><Group gap="xs" wrap="nowrap"><input name="title" placeholder="Adicionar item" aria-label="Novo item da lista de compras" maxLength={120} style={{ flex: 1, height: 38, borderRadius: 19, border: "1px solid #cfe5ca", padding: "0 14px", background: "rgba(255,255,255,0.7)", color: "inherit" }} /><Button type="submit" size="compact-md" color="sage.7" aria-label="Adicionar">+</Button></Group></form>
          </Stack>
        </Panel>
      </Stack>
    </>
  );
}
