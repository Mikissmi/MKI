import { after } from "next/server";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { refreshFeeds, staleFeedCount } from "@/lib/news";
import { TONES, type Tone } from "@/lib/tones";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton, LinkIconButton } from "@/components/LinkButton";
import { Cover } from "@/components/ui/Cover";
import { toggleFavorite, toggleRead, saveForLater, refreshNow, markAllRead } from "./actions";

export const metadata = { title: "Notícias" };

type Item = { id: string; title: string; link: string; summary: string | null; image_url: string | null; published_at: string | null; read: boolean; favorite: boolean; feed_title: string; topic_id: string | null; tone: Tone | null };
const FALLBACK: Tone[] = ["pink", "sage", "lavender", "sun"];

const ago = (iso: string | null) => {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `há ${Math.max(1, m)} min`;
  if (m < 1440) return `há ${Math.round(m / 60)} h`;
  return `há ${Math.round(m / 1440)} d`;
};

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ t?: string; s?: string; f?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const uid = user.id;

  // Sem tarefa agendada: ao abrir a tela, atualiza em segundo plano os feeds que passaram do intervalo mínimo.
  if ((await staleFeedCount(uid)) > 0) after(() => refreshFeeds(uid).catch(() => {}));

  const [topics, feeds] = await Promise.all([
    query<{ id: string; name: string; tone: Tone }>("SELECT id, name, tone FROM topics WHERE user_id = $1 ORDER BY created_at", [uid]),
    query<{ id: string; title: string; muted: boolean; last_error: string | null }>("SELECT id, title, muted, last_error FROM feeds WHERE user_id = $1 ORDER BY title", [uid]),
  ]);
  const topicId = topics.find((t) => t.id === sp.t)?.id ?? "";
  const feedId = feeds.find((f) => f.id === sp.s)?.id ?? "";
  const filter = sp.f === "nao-lidas" || sp.f === "favoritas" ? sp.f : "";
  const q = (sp.q ?? "").trim().slice(0, 60);

  const items = await query<Item>(
    `SELECT n.id, n.title, n.link, n.summary, n.image_url, n.published_at, n.read, n.favorite, f.title AS feed_title, n.topic_id, t.tone
       FROM news_items n JOIN feeds f ON f.id = n.feed_id AND NOT f.muted LEFT JOIN topics t ON t.id = n.topic_id
      WHERE n.user_id = $1 AND ($2 = '' OR n.topic_id::text = $2) AND ($3 = '' OR n.feed_id::text = $3)
        AND ($4 <> 'nao-lidas' OR NOT n.read) AND ($4 <> 'favoritas' OR n.favorite)
        AND ($5 = '' OR n.title ILIKE '%' || $5 || '%' OR n.summary ILIKE '%' || $5 || '%')
      ORDER BY n.published_at DESC NULLS LAST, n.created_at DESC LIMIT 40`, [uid, topicId, feedId, filter, q]);
  const base = (extra: Record<string, string>) => { const p = new URLSearchParams({ ...(topicId && { t: topicId }), ...(feedId && { s: feedId }), ...(filter && { f: filter }), ...(q && { q }), ...extra }); for (const [k, v] of [...p]) if (!v) p.delete(k); return `/noticias${p.size ? `?${p}` : ""}`; };

  return (
    <>
      <PageHeader title="Notícias" action={<LinkIconButton href="/noticias/fontes" size={40} radius="xl" variant="light" color="lotus" aria-label="Fontes e temas"><Icon name="rss" size={20} /></LinkIconButton>} />
      <Stack gap="md">
        <form action="/noticias" method="get">
          {topicId && <input type="hidden" name="t" value={topicId} />}{feedId && <input type="hidden" name="s" value={feedId} />}{filter && <input type="hidden" name="f" value={filter} />}
          <Group gap="xs" wrap="nowrap"><input name="q" defaultValue={q} placeholder="Buscar nas notícias" aria-label="Buscar nas notícias" style={{ flex: 1, height: 40, borderRadius: 20, border: "1px solid #ecd9cf", padding: "0 14px", background: "var(--mantine-color-body)", color: "inherit" }} /><Button type="submit" variant="light" size="compact-md" aria-label="Buscar"><Icon name="search" size={16} /></Button></Group>
        </form>

        <Group gap={6} wrap="nowrap" style={{ overflowX: "auto", paddingBottom: 2 }}>
          <LinkButton href={base({ t: "" })} size="compact-sm" style={{ flexShrink: 0 }} variant={topicId === "" ? "filled" : "light"}>Tudo</LinkButton>
          {topics.map((t) => <LinkButton key={t.id} href={base({ t: t.id })} size="compact-sm" style={{ flexShrink: 0 }} variant={topicId === t.id ? "filled" : "light"}>{t.name}</LinkButton>)}
        </Group>
        <Group gap={6} wrap="wrap">
          <LinkButton href={base({ f: filter === "nao-lidas" ? "" : "nao-lidas" })} size="compact-xs" variant={filter === "nao-lidas" ? "filled" : "subtle"} color="gray">Não lidas</LinkButton>
          <LinkButton href={base({ f: filter === "favoritas" ? "" : "favoritas" })} size="compact-xs" variant={filter === "favoritas" ? "filled" : "subtle"} color="gray">Favoritas</LinkButton>
          {feeds.length > 1 && feeds.filter((f) => !f.muted).map((f) => <LinkButton key={f.id} href={base({ s: feedId === f.id ? "" : f.id })} size="compact-xs" variant={feedId === f.id ? "filled" : "subtle"} color="gray">{f.title}</LinkButton>)}
        </Group>

        {feeds.length === 0 && (
          <Box p="md" style={{ border: "2px dashed var(--mantine-color-lotus-3)", borderRadius: 20 }}>
            <Text fw={800}>Adicione suas fontes</Text>
            <Text size="sm" c="dimmed" mb="xs">Cole o endereço de sites e blogs de que você gosta. O MKI lê os feeds RSS deles e monta o seu painel de notícias.</Text>
            <LinkButton href="/noticias/fontes" size="compact-md">Adicionar fontes</LinkButton>
          </Box>
        )}
        {feeds.length > 0 && items.length === 0 && <Text size="sm" c="dimmed">Nenhuma notícia {filter || topicId || feedId || q ? "com esse filtro" : "ainda. Os feeds são atualizados ao abrir esta tela; volte em instantes"}.</Text>}

        {items.map((n, i) => {
          const tone = n.tone ?? FALLBACK[i % FALLBACK.length];
          const t = TONES[tone];
          return (
            <Box key={n.id} p="sm" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 24, color: t.fg }}>
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Group gap={6}><Text size="xs" fw={800} c="inherit">{n.feed_title}</Text><Text size="xs" c="inherit" style={{ opacity: 0.9 }}>{ago(n.published_at)}</Text></Group>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}><Text fw={800} lh={1.25} mt={2}>{n.title}</Text></a>
                  {n.summary && <Text size="sm" mt={4} lineClamp={3} style={{ opacity: 0.85 }}>{n.summary}</Text>}
                </div>
                {n.image_url && <Cover url={n.image_url} width={84} height={84} radius={16} />}
              </Group>
              <Group gap={6} mt="xs" justify="space-between" wrap="nowrap">
                <form action={toggleRead}><input type="hidden" name="id" value={n.id} />
                  <Button type="submit" size="compact-xs" variant="subtle" color="dark" c="inherit" leftSection={<Icon name={n.read ? "square-check" : "check"} size={14} />}>{n.read ? "Lida" : "Marcar como lida"}</Button></form>
                <Group gap={4} wrap="nowrap">
                  <form action={saveForLater}><input type="hidden" name="id" value={n.id} /><Button type="submit" size="compact-xs" variant="white" color="dark" leftSection={<Icon name="book2" size={13} />}>Ler depois</Button></form>
                  <form action={toggleFavorite}><input type="hidden" name="id" value={n.id} /><Button type="submit" size="compact-xs" variant={n.favorite ? "filled" : "white"} color={n.favorite ? "lotus" : "gray"} aria-label={n.favorite ? "Remover dos favoritos" : "Favoritar"} aria-pressed={n.favorite}><Icon name={n.favorite ? "bookmark-filled" : "bookmark"} size={15} /></Button></form>
                </Group>
              </Group>
            </Box>
          );
        })}

        {items.length > 0 && (
          <Group justify="center" gap="xs">
            <form action={refreshNow}><Button type="submit" size="compact-sm" variant="light" leftSection={<Icon name="refresh" size={14} />}>Atualizar agora</Button></form>
            <form action={markAllRead}><Button type="submit" size="compact-sm" variant="subtle" color="dark">Marcar tudo como lido</Button></form>
          </Group>
        )}
      </Stack>
    </>
  );
}
