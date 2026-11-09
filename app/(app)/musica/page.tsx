import { Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fetchCheckin } from "@/lib/agenda/queries";
import { localDateKey } from "@/lib/time";
import { AUDIO_KINDS, MOODS } from "@/lib/options";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { TabLinks } from "@/components/ui/TabLinks";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteAudio, deletePlaylist, saveAudio, savePlaylist } from "./actions";

export const metadata = { title: "Música e podcasts" };

const audioFields: Field[] = [
  { name: "kind", label: "Tipo", type: "select", options: AUDIO_KINDS.map((k) => ({ value: k.value, label: k.label })) },
  { name: "title", label: "Título", required: true, maxLength: 160 }, { name: "creator", label: "Artista ou criador(a)", maxLength: 120 },
  { name: "status", label: "Status", type: "select", options: [{ value: "quero", label: "Para ouvir" }, { value: "ouvido", label: "Ouvido" }] },
  { name: "rating", label: "Nota (0 a 5)", type: "decimal", placeholder: "4,5" }, { name: "progress", label: "Progresso (podcast)", placeholder: "Ep. 24 · 32 min restantes", maxLength: 80 },
  { name: "cover_url", label: "Link da capa", type: "url" }, { name: "link", label: "Link para ouvir", type: "url" }, { name: "comment", label: "Comentário", type: "textarea", maxLength: 500 },
];
const playlistFields: Field[] = [
  { name: "title", label: "Nome", required: true, maxLength: 120 }, { name: "subtitle", label: "Descrição curta", maxLength: 160 }, { name: "url", label: "Link da playlist", type: "url" },
  { name: "cover_url", label: "Link da imagem", type: "url" }, { name: "mood", label: "Combina com o humor", type: "select", options: MOODS.map((m) => ({ value: m.value, label: m.label })) },
  { name: "is_today", label: "Usar como trilha do dia", type: "switch" },
];
const fmtRating = (r: string | number | null) => (r === null ? "" : `${Number(r).toFixed(1).replace(".", ",")} estrelas`);

export default async function MusicPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const user = await requireUser();
  const tab = (await searchParams).t === "ouvidos" ? "ouvidos" : "ouvir";
  const status = tab === "ouvidos" ? "ouvido" : "quero";
  const [items, playlists, lastPod, checkin] = await Promise.all([
    query<{ id: string; kind: string; title: string; creator: string | null; status: string; rating: string | null; comment: string | null; cover_url: string | null; link: string | null; progress: string | null }>(
      "SELECT id, kind, title, creator, status, rating, comment, cover_url, link, progress FROM audio_items WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC", [user.id, status]),
    query<{ id: string; title: string; subtitle: string | null; url: string | null; cover_url: string | null; mood: string | null; is_today: boolean }>("SELECT id, title, subtitle, url, cover_url, mood, is_today FROM playlists WHERE user_id = $1 ORDER BY is_today DESC, created_at DESC", [user.id]),
    query<{ id: string; title: string; creator: string | null; progress: string | null; cover_url: string | null; link: string | null }>("SELECT id, title, creator, progress, cover_url, link FROM audio_items WHERE user_id = $1 AND kind = 'podcast' AND progress IS NOT NULL ORDER BY created_at DESC LIMIT 1", [user.id]),
    fetchCheckin(user.id, localDateKey()),
  ]);
  // Trilha do dia: a marcada como "do dia"; senão uma que combine com o humor de hoje; senão a mais recente.
  const moodKey = checkin ? (checkin.mood <= 2 ? "calmo" : checkin.mood >= 4 ? "animado" : null) : null;
  const trilha = playlists.find((p) => p.is_today) ?? playlists.find((p) => moodKey && p.mood === moodKey) ?? playlists[0];

  return (
    <>
      <PageHeader title="Música e podcasts" back="/mais" action={<AddSheet title="Adicionar" fields={audioFields} values={{ kind: "album", status }} action={saveAudio} />} />
      <Stack gap="md">
        <TabLinks active={tab} items={[{ key: "ouvir", label: "Para ouvir", href: "/musica?t=ouvir" }, { key: "ouvidos", label: "Ouvidos", href: "/musica?t=ouvidos" }]} />

        <Panel tone="pink" title="Trilha do dia" icon="music" action={<AddSheet title="Nova playlist" label="Playlist" fields={playlistFields} values={{ mood: "" }} action={savePlaylist} />}>
          {trilha ? (
            <Group wrap="nowrap" gap="md" align="flex-start">
              <Cover url={trilha.cover_url} icon="music" width={96} height={96} radius={18} />
              <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Text fw={800} fz={18} lh={1.2}>{trilha.title}</Text>
                {trilha.subtitle && <Text size="sm" style={{ opacity: 0.8 }}>{trilha.subtitle}</Text>}
                <Group gap={6}>{trilha.mood && <Pill tone="lavender">{trilha.mood}</Pill>}{trilha.is_today && <Pill tone="pink">do dia</Pill>}</Group>
                <Group gap={6}>
                  {trilha.url && <Button component="a" href={trilha.url} target="_blank" rel="noopener noreferrer" size="compact-sm" leftSection={<Icon name="play" size={14} />} rightSection={<Icon name="external" size={12} />}>Abrir no app de música</Button>}
                  <FormSheet title="Editar playlist" fields={playlistFields} values={{ id: trilha.id, title: trilha.title, subtitle: trilha.subtitle, url: trilha.url, cover_url: trilha.cover_url, mood: trilha.mood ?? "", is_today: trilha.is_today }} action={savePlaylist} remove={deletePlaylist} block={false}><Button component="span" size="compact-sm" variant="white" color="gray">Editar</Button></FormSheet>
                </Group>
              </Stack>
            </Group>
          ) : <Text size="sm" style={{ opacity: 0.8 }}>Cadastre uma playlist e associe a um humor. Ela abre no seu app de música.</Text>}
          {playlists.length > 1 && <Group gap={6} mt="sm">{playlists.filter((p) => p.id !== trilha?.id).map((p) => (
            <FormSheet key={p.id} title="Editar playlist" fields={playlistFields} values={{ id: p.id, title: p.title, subtitle: p.subtitle, url: p.url, cover_url: p.cover_url, mood: p.mood ?? "", is_today: p.is_today }} action={savePlaylist} remove={deletePlaylist} block={false}><Pill tone="plain">{p.title}</Pill></FormSheet>))}</Group>}
        </Panel>

        <Panel tone="sun" title="Álbuns e podcasts" icon="headphones">
          {items.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>{tab === "ouvir" ? "Sua lista para ouvir está vazia." : "Nada marcado como ouvido ainda."}</Text>}
          <SimpleGrid cols={3} spacing="xs">
            {items.map((a) => (
              <FormSheet key={a.id} title="Editar" fields={audioFields} values={{ id: a.id, kind: a.kind, title: a.title, creator: a.creator, status: a.status, rating: a.rating?.replace(".", ","), progress: a.progress, cover_url: a.cover_url, link: a.link, comment: a.comment }} action={saveAudio} remove={deleteAudio}>
                <Box ta="center">
                  <Cover url={a.cover_url} icon={a.kind === "podcast" ? "mic" : "music"} tone="sun" width={92} height={92} radius={16} />
                  <Text size="xs" fw={800} lh={1.2} mt={4} lineClamp={2}>{a.title}</Text>
                  {a.rating !== null && <Group gap={3} justify="center"><Icon name="star-filled" size={11} color="#f2c534" /><Text size="10px">{fmtRating(a.rating)}</Text></Group>}
                </Box>
              </FormSheet>
            ))}
          </SimpleGrid>
        </Panel>

        {lastPod[0] && (
          <Panel tone="lavender" title="Último episódio ouvido" icon="headphones">
            <Group wrap="nowrap" gap="sm">
              <Cover url={lastPod[0].cover_url} icon="mic" tone="lavender" width={64} height={64} radius={14} />
              <div style={{ flex: 1, minWidth: 0 }}><Text fw={800}>{lastPod[0].title}</Text><Text size="sm" style={{ opacity: 0.8 }}>{lastPod[0].progress}</Text></div>
              {lastPod[0].link && <Button component="a" href={lastPod[0].link} target="_blank" rel="noopener noreferrer" size="compact-md" radius="xl" aria-label="Continuar ouvindo" color="lavender.6"><Icon name="play" size={16} /></Button>}
            </Group>
          </Panel>
        )}
      </Stack>
    </>
  );
}
