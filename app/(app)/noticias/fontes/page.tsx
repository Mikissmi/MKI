import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { SUGGESTED_FEEDS, TOPIC_PRESETS } from "@/lib/news";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { addFeedAction, addPresetTopic, addSuggestedFeed, deleteFeed, deleteTopic, saveTopic, toggleMuteFeed } from "../actions";

export const metadata = { title: "Fontes e temas" };

export default async function SourcesPage() {
  const user = await requireUser();
  const [feeds, topics] = await Promise.all([
    query<{ id: string; title: string; url: string; muted: boolean; last_error: string | null; last_fetched_at: string | null; topic: string | null; n: string }>(
      `SELECT f.id, f.title, f.url, f.muted, f.last_error, f.last_fetched_at, t.name AS topic, (SELECT count(*) FROM news_items n WHERE n.feed_id = f.id)::text AS n
         FROM feeds f LEFT JOIN topics t ON t.id = f.topic_id WHERE f.user_id = $1 ORDER BY f.title`, [user.id]),
    query<{ id: string; name: string; keywords: string[]; tone: string }>("SELECT id, name, keywords, tone FROM topics WHERE user_id = $1 ORDER BY created_at", [user.id]),
  ]);
  const feedFields: Field[] = [
    { name: "url", label: "Endereço do site ou do feed RSS", type: "url", required: true, placeholder: "https://seusite.com", description: "Se for o site, o MKI procura o feed sozinho." },
    { name: "topic_id", label: "Tema deste feed (opcional)", type: "select", options: [{ value: "", label: "Automático, pelas palavras-chave" }, ...topics.map((t) => ({ value: t.id, label: t.name }))] },
  ];
  const topicFields: Field[] = [
    { name: "name", label: "Nome do tema", required: true, maxLength: 40 }, { name: "keywords", label: "Palavras-chave (separe por vírgula)", placeholder: "ciência, pesquisa, descoberta" },
    { name: "tone", label: "Cor", type: "select", options: [{ value: "pink", label: "Rosa" }, { value: "sage", label: "Verde" }, { value: "sun", label: "Amarelo" }, { value: "lavender", label: "Lavanda" }] },
  ];
  const have = new Set(feeds.map((f) => f.url));
  const haveTopics = new Set(topics.map((t) => t.name));

  return (
    <>
      <PageHeader title="Fontes e temas" back="/noticias" />
      <Stack gap="md">
        <Panel tone="plain" title="Fontes (RSS)" icon="rss" action={<AddSheet title="Adicionar fonte" fields={feedFields} values={{ topic_id: "" }} action={addFeedAction} submitLabel="Adicionar" />}>
          <Stack gap={8}>
            {feeds.length === 0 && <Text size="sm" c="dimmed">Nenhuma fonte ainda.</Text>}
            {feeds.map((f) => (
              <Box key={f.id} p="xs" style={{ border: "1px solid light-dark(#f0e4d2, var(--mantine-color-dark-4))", borderRadius: 16, opacity: f.muted ? 0.6 : 1 }}>
                <Group justify="space-between" wrap="nowrap"><div style={{ minWidth: 0 }}><Text size="sm" fw={800} truncate>{f.title}</Text><Text size="xs" c="dimmed" truncate>{f.url}</Text></div>{f.topic && <Pill tone="lavender">{f.topic}</Pill>}</Group>
                <Text size="xs" c={f.last_error ? "red" : "dimmed"} mt={2}>{f.last_error ? `Erro: ${f.last_error}` : `${f.n} notícias guardadas`}</Text>
                <Group gap={6} mt={6}>
                  <form action={toggleMuteFeed}><input type="hidden" name="id" value={f.id} /><Button type="submit" size="compact-xs" variant="light" color="gray">{f.muted ? "Reativar" : "Silenciar"}</Button></form>
                  <form action={deleteFeed}><input type="hidden" name="id" value={f.id} /><Button type="submit" size="compact-xs" variant="subtle" color="red">Remover</Button></form>
                </Group>
              </Box>
            ))}
          </Stack>
          {SUGGESTED_FEEDS.some((s) => !have.has(s.url)) && (<>
            <Text size="xs" fw={800} mt="md" mb={4}>Sugestões (toque para adicionar)</Text>
            <Group gap={6}>{SUGGESTED_FEEDS.filter((s) => !have.has(s.url)).map((s) => (
              <form key={s.url} action={addSuggestedFeed}><input type="hidden" name="url" value={s.url} /><Button type="submit" size="compact-xs" variant="light" leftSection={<Icon name="plus" size={12} />}>{s.title} · {s.theme}</Button></form>))}</Group>
          </>)}
        </Panel>

        <Panel tone="lavender" title="Temas de interesse" icon="sparkles" action={<AddSheet title="Novo tema" fields={topicFields} values={{ tone: "pink" }} action={saveTopic} />}>
          <Text size="xs" mb="xs" style={{ opacity: 0.9 }}>As matérias com essas palavras no título ou no resumo ganham o tema e aparecem nos filtros.</Text>
          <Stack gap={6}>
            {topics.map((t) => (
              <FormSheet key={t.id} title="Editar tema" fields={topicFields} values={{ id: t.id, name: t.name, keywords: t.keywords.join(", "), tone: t.tone }} action={saveTopic} remove={deleteTopic}>
                <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={800}>{t.name}</Text><Text size="xs" truncate style={{ opacity: 0.9 }}>{t.keywords.slice(0, 4).join(", ")}</Text></Group>
              </FormSheet>
            ))}
          </Stack>
          {TOPIC_PRESETS.some((p) => !haveTopics.has(p.name)) && (
            <Group gap={6} mt="sm">{TOPIC_PRESETS.filter((p) => !haveTopics.has(p.name)).map((p) => (
              <form key={p.name} action={addPresetTopic}><input type="hidden" name="name" value={p.name} /><input type="hidden" name="tone" value={p.tone} /><input type="hidden" name="keywords" value={p.keywords.join(",")} />
                <Button type="submit" size="compact-xs" variant="white" color="lavender.7" leftSection={<Icon name="plus" size={12} />}>{p.name}</Button></form>))}</Group>
          )}
        </Panel>
      </Stack>
    </>
  );
}
