import { notFound } from "next/navigation";
import { z } from "zod";
import { Box, Button, Group, Stack, Text, Title } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fmtDateKey } from "@/lib/format";
import { localDateKey } from "@/lib/time";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { ArticleBody, AiSummaryButton } from "@/components/ArticleReader";
import { FormSheet } from "@/components/forms/FormSheet";
import { noteForNews, saveForLater, toggleRead } from "../actions";

export const metadata = { title: "Notícia" };

const SOURCE_LABEL: Record<string, string> = { feed: "Resumo do feed", texto: "Resumo do texto", ia: "Resumo com IA" };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

export default async function NewsReader({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const n = await queryOne<{ id: string; title: string; link: string; summary: string | null; summary_source: string | null; image_url: string | null; published_at: string | null; read: boolean; reading_item_id: string | null; source: string; item_status: string | null }>(
    `SELECT n.id, n.title, n.link, n.summary, n.summary_source, n.image_url, n.published_at, n.read, n.reading_item_id, f.title AS source, r.status AS item_status
       FROM news_items n JOIN feeds f ON f.id = n.feed_id LEFT JOIN reading_items r ON r.id = n.reading_item_id WHERE n.id = $1 AND n.user_id = $2`, [id.data, user.id]);
  if (!n) notFound();
  const notes = n.reading_item_id ? await query<{ id: string; quote: string | null; note: string | null }>("SELECT id, quote, note FROM reading_notes WHERE item_id = $1 AND user_id = $2 ORDER BY created_at DESC", [n.reading_item_id, user.id]) : [];
  const date = n.published_at ? fmtDateKey(localDateKey(new Date(n.published_at))) : null;

  return (
    <>
      <PageHeader title="Notícia" back="/noticias" />
      <Stack gap="md">
        <Box>
          <Group gap={8} mb={6}><Text size="sm" fw={800} c="lotus.8">{n.source}</Text>{date && <Text size="sm" c="dimmed">{date}</Text>}{n.read && <Pill tone="sage" icon="check">lida</Pill>}</Group>
          <Title order={1} fz={24} lh={1.2}>{n.title}</Title>
          <Text size="xs" c="dimmed" mt={4}>{host(n.link)}</Text>
        </Box>
        {n.image_url && <Cover url={n.image_url} width={358} height={180} radius={20} />}

        <Panel tone="lavender" title={n.summary_source ? SOURCE_LABEL[n.summary_source] : "Resumo"} icon="sparkles">
          <Stack gap="sm">
            <Text size="sm" style={{ lineHeight: 1.55 }}>{n.summary ?? "Esta matéria ainda não tem resumo. Ele aparece quando o texto for carregado."}</Text>
            <AiSummaryButton newsId={n.id} />
          </Stack>
        </Panel>

        <ArticleBody newsId={n.id} link={n.link} />

        <Group gap="xs">
          <form action={toggleRead}><input type="hidden" name="id" value={n.id} />
            <Button type="submit" size="md" variant={n.read ? "light" : "filled"} leftSection={<Icon name={n.read ? "square-check" : "check"} size={18} />}>{n.read ? "Lida (desmarcar)" : "Marcar como lida"}</Button></form>
          {!n.read && <form action={saveForLater}><input type="hidden" name="id" value={n.id} /><Button type="submit" size="md" variant="light" leftSection={<Icon name="bookmark" size={18} />} disabled={n.item_status === "quero"}>{n.item_status === "quero" ? "Na fila de leitura" : "Ler depois"}</Button></form>}
          <Button component="a" href={n.link} target="_blank" rel="noopener noreferrer" size="md" variant="subtle" color="dark" rightSection={<Icon name="external" size={16} />}>Abrir no site</Button>
        </Group>
        {n.item_status && <Text size="xs" c="dimmed">Em Leituras, em Artigos: {n.item_status === "lido" ? "lido" : "quero ler"}.</Text>}

        <Panel tone="plain" title="Minhas anotações" icon="notes" action={
          <FormSheet title="Nova anotação" fields={[{ name: "quote", label: "Trecho ou citação", type: "textarea" }, { name: "note", label: "Minha anotação", type: "textarea" }]} hidden={{ news_id: n.id }} action={noteForNews} block={false}>
            <Button component="span" size="compact-sm" variant="light" leftSection={<span aria-hidden="true">+</span>}>Anotar</Button>
          </FormSheet>}>
          <Stack gap={8}>
            {notes.length === 0 && <Text size="sm" c="dimmed">Suas anotações ficam no artigo, em Leituras.</Text>}
            {notes.map((x) => <Box key={x.id} p="xs" style={{ background: "rgba(0,0,0,0.03)", borderRadius: 14 }}>{x.quote && <Text size="sm" fs="italic">"{x.quote}"</Text>}{x.note && <Text size="sm">{x.note}</Text>}</Box>)}
          </Stack>
        </Panel>
      </Stack>
    </>
  );
}
