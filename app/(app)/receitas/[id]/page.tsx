import { notFound } from "next/navigation";
import { z } from "zod";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { ingredientLines } from "@/lib/activities";
import { fmtDateKey } from "@/lib/format";
import { localDateKey } from "@/lib/time";
import { recipeFields } from "@/lib/recipes";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { FormSheet } from "@/components/forms/FormSheet";
import { cookedToday, deleteRecipe, ingredientsToShopping, saveRecipe } from "../actions";

export const metadata = { title: "Receita" };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const r = await queryOne<{ id: string; title: string; ingredients: string | null; steps: string | null; minutes: number | null; servings: number | null; photo_url: string | null; rating: string | null; tags: string[]; source_url: string | null }>(
    "SELECT id, title, ingredients, steps, minutes, servings, photo_url, rating, tags, source_url FROM recipes WHERE id = $1 AND user_id = $2", [id.data, user.id]);
  if (!r) notFound();
  const cooked = await query<{ date: string }>("SELECT date::text AS date FROM cooked_log WHERE recipe_id = $1 AND user_id = $2 ORDER BY date DESC", [r.id, user.id]);
  const cookedToday_ = cooked[0]?.date === localDateKey();
  const steps = (r.steps ?? "").split(/\r?\n/).map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);

  return (
    <>
      <PageHeader title={r.title} back="/receitas" />
      <Stack gap="md">
        <Panel tone="sun">
          <Group wrap="nowrap" align="flex-start" gap="md">
            <Cover url={r.photo_url} icon="chef" tone="sun" width={104} height={104} radius={18} />
            <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
              <Group gap={10}>{r.minutes && <Group gap={4}><Icon name="clock" size={14} /><Text size="sm" fw={700}>{r.minutes} min</Text></Group>}{r.servings && <Text size="sm">{r.servings} porções</Text>}{r.rating && <Group gap={3}><Icon name="star-filled" size={14} color="#f2c534" /><Text size="sm" fw={700}>{Number(r.rating).toFixed(1).replace(".", ",")}</Text></Group>}</Group>
              <Group gap={4}>{r.tags.map((t) => <Pill key={t} tone="sage">{t}</Pill>)}</Group>
              <Text size="xs" style={{ opacity: 0.9 }}>{cooked.length === 0 ? "Ainda não cozinhada" : `Cozinhada ${cooked.length}x · última em ${fmtDateKey(cooked[0].date)}`}</Text>
            </Stack>
          </Group>
          <Group gap={6} mt="sm">
            <form action={cookedToday}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="compact-sm" disabled={cookedToday_} leftSection={<Icon name="chef" size={14} />}>{cookedToday_ ? "Cozinhado hoje" : "Cozinhei hoje"}</Button></form>
            <FormSheet title="Editar receita" fields={recipeFields} values={{ id: r.id, title: r.title, ingredients: r.ingredients, steps: r.steps, minutes: r.minutes, servings: r.servings, rating: r.rating?.replace(".", ","), tags: r.tags.join(", "), photo_url: r.photo_url, source_url: r.source_url }} action={saveRecipe} remove={deleteRecipe} block={false}><Button component="span" size="compact-sm" variant="white" color="dark">Editar</Button></FormSheet>
            {r.source_url && <Button component="a" href={r.source_url} target="_blank" rel="noopener noreferrer" size="compact-sm" variant="white" color="dark" rightSection={<Icon name="external" size={12} />}>Original</Button>}
          </Group>
        </Panel>
        <Panel tone="sage" title="Ingredientes" icon="cart" action={<form action={ingredientsToShopping}><input type="hidden" name="id" value={r.id} /><Button type="submit" size="compact-xs" variant="white" color="sage.8">Enviar à lista de compras</Button></form>}>
          <Stack gap={4}>{ingredientLines(r.ingredients).map((l, i) => <Group key={i} gap={8} wrap="nowrap"><Box w={6} h={6} style={{ borderRadius: 3, background: "var(--mantine-color-sage-6)", flexShrink: 0 }} /><Text size="sm">{l}</Text></Group>)}{!r.ingredients && <Text size="sm" style={{ opacity: 0.9 }}>Sem ingredientes cadastrados.</Text>}</Stack>
        </Panel>
        <Panel tone="plain" title="Modo de preparo" icon="list">
          <Stack gap={8}>{steps.map((s, i) => <Group key={i} gap={10} wrap="nowrap" align="flex-start"><Text fw={800} c="lotus.6" w={20}>{i + 1}</Text><Text size="sm">{s}</Text></Group>)}{steps.length === 0 && <Text size="sm" c="dimmed">Sem passos cadastrados.</Text>}</Stack>
        </Panel>
      </Stack>
    </>
  );
}
