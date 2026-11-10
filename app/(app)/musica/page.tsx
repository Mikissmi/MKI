import { Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { localDateKey } from "@/lib/time";
import { AUDIO_KINDS, MOODS } from "@/lib/options";
import { Icon } from "@/lib/icons";
import { getSettings } from "@/lib/settings";
import { loadTrilha } from "@/lib/trilha";
import { getPlaylists, spotifyErrorText, spotifyStatus, syncListened } from "@/lib/spotify/service";
import { SpotifyRefresh, SpotifySearch } from "@/components/SpotifySearch";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";
import { TabLinks } from "@/components/ui/TabLinks";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteAudio, deletePlaylist, saveAudio, savePlaylist } from "./actions";
import { useSpotifyPlaylist } from "./spotify-actions";

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
  const settings = await getSettings(user.id);
  // Spotify: só ao abrir esta tela. Respeita o intervalo mínimo; em qualquer falha usa o que já estava guardado.
  const hist = await syncListened(user.id);
  const sp = await getPlaylists(user.id);
  const [items, lastPod, activities, { trilha, playlists }] = await Promise.all([
    query<{ id: string; kind: string; title: string; creator: string | null; status: string; rating: string | null; comment: string | null; cover_url: string | null; link: string | null; progress: string | null; spotify_id: string | null }>(
      "SELECT id, kind, title, creator, status, rating, comment, cover_url, link, progress, spotify_id FROM audio_items WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC", [user.id, status]),
    query<{ id: string; title: string; creator: string | null; progress: string | null; cover_url: string | null; link: string | null }>("SELECT id, title, creator, progress, cover_url, link FROM audio_items WHERE user_id = $1 AND kind = 'podcast' AND progress IS NOT NULL ORDER BY created_at DESC LIMIT 1", [user.id]),
    query<{ id: string; name: string }>("SELECT id, name FROM activities WHERE user_id = $1 ORDER BY name", [user.id]),
    loadTrilha(user.id, localDateKey(), true),
  ]);
  const status2 = await spotifyStatus(user.id, settings.spotifyFeatures);
  const spError = sp.error ?? hist.error;
  const needsReconnect = status2.connected && (status2.needsReconnect || spError?.kind === "reauth" || status2.missingScopes.length > 0);
  const playlistFormFields: Field[] = [
    { name: "mood", label: "Combina com o humor", type: "select", options: MOODS.map((m) => ({ value: m.value, label: m.label })) },
    { name: "activity_id", label: "Ou com a atividade", type: "select", options: [{ value: "", label: "Nenhuma" }, ...activities.map((a) => ({ value: a.id, label: a.name }))] },
    { name: "is_today", label: "Usar como trilha do dia", type: "switch" },
  ];
  const usedIds = new Map(playlists.filter((p) => p.spotify_playlist_id).map((p) => [p.spotify_playlist_id!, p]));

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
                {trilha.subtitle && <Text size="sm" style={{ opacity: 0.9 }}>{trilha.subtitle}</Text>}
                <Group gap={6}>{trilha.mood && <Pill tone="lavender">{trilha.mood}</Pill>}{trilha.is_today && <Pill tone="pink">do dia</Pill>}</Group>
                <Group gap={6}>
                  {trilha.url && <Button component="a" href={trilha.url} target="_blank" rel="noopener noreferrer" size="compact-sm" leftSection={<Icon name="play" size={14} />} rightSection={<Icon name="external" size={12} />}>{trilha.spotify_playlist_id ? "Abrir no Spotify" : "Abrir no app de música"}</Button>}
                  <FormSheet title="Editar playlist" fields={playlistFields} values={{ id: trilha.id, title: trilha.title, subtitle: trilha.subtitle, url: trilha.url, cover_url: trilha.cover_url, mood: trilha.mood ?? "", is_today: trilha.is_today }} action={savePlaylist} remove={deletePlaylist} block={false}><Button component="span" size="compact-sm" variant="white" color="dark">Editar</Button></FormSheet>
                </Group>
              </Stack>
            </Group>
          ) : <Text size="sm" style={{ opacity: 0.9 }}>Cadastre uma playlist e associe a um humor. Ela abre no seu app de música.</Text>}
          {playlists.length > 1 && <Group gap={6} mt="sm">{playlists.filter((p) => p.id !== trilha?.id).map((p) => (
            <FormSheet key={p.id} title="Editar playlist" fields={playlistFields} values={{ id: p.id, title: p.title, subtitle: p.subtitle, url: p.url, cover_url: p.cover_url, mood: p.mood ?? "", is_today: p.is_today }} action={savePlaylist} remove={deletePlaylist} block={false}><Pill tone="plain">{p.title}</Pill></FormSheet>))}</Group>}
        </Panel>

        {(status2.connected || status2.configured) && (
          <Panel tone="sage" title="Spotify" icon="music" action={status2.connected ? <Pill tone="plain">{status2.displayName ?? "conectado"}</Pill> : <Pill tone="lavender" icon="lock">desconectado</Pill>}>
            <Stack gap="sm">
              {!status2.connected && <><Text size="sm">Conecte sua conta para usar suas playlists e buscar álbuns e podcasts.</Text><LinkButton href="/configuracoes" size="compact-sm">Ir para Configurações</LinkButton></>}
              {needsReconnect && (
                <Box p="sm" role="alert" style={{ background: "rgba(255,255,255,0.6)", borderRadius: 14 }}>
                  <Text size="sm" fw={700}>{status2.missingScopes.length > 0 && !status2.needsReconnect ? "Um recurso novo precisa de uma permissão a mais." : "A conexão com o Spotify precisa ser refeita."}</Text>
                  <Text size="xs" mb={6}>O que já estava guardado continua aparecendo aqui.</Text>
                  <LinkButton href="/configuracoes#spotify" size="compact-sm">Reconectar</LinkButton>
                </Box>
              )}
              {spError && spError.kind !== "reauth" && <Text size="sm" role="status" fw={600}>{spotifyErrorText(spError)}</Text>}
              {status2.connected && settings.spotifyFeatures.search && <SpotifySearch disabled={needsReconnect} />}
              {status2.connected && settings.spotifyFeatures.playlists && (
                <div>
                  <Group justify="space-between" mb={6}><Text size="sm" fw={800}>Suas playlists</Text><SpotifyRefresh /></Group>
                  {sp.data.length === 0 && <Text size="sm" c="dimmed">Nenhuma playlist guardada ainda. Toque em "Atualizar do Spotify".</Text>}
                  <Stack gap={8}>
                    {sp.data.map((p) => {
                      const used = usedIds.get(p.id);
                      return (
                        <Group key={p.id} wrap="nowrap" gap="sm">
                          <Cover url={p.cover} icon="music" tone="sage" width={48} height={48} radius={10} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={700} lineClamp={1}>{p.name}</Text>
                            {used && <Group gap={4}>{used.is_today && <Pill tone="pink">do dia</Pill>}{used.mood && <Pill tone="lavender">{used.mood}</Pill>}</Group>}
                          </div>
                          {p.url && <Button component="a" href={p.url} target="_blank" rel="noopener noreferrer" size="compact-xs" variant="subtle" aria-label={`Abrir ${p.name} no Spotify`}><Icon name="external" size={14} /></Button>}
                          <FormSheet title={`Trilha: ${p.name}`} fields={playlistFormFields} values={{ mood: used?.mood ?? "", activity_id: used?.activity_id ?? "", is_today: used?.is_today ?? false }} hidden={{ spotify_id: p.id }} action={useSpotifyPlaylist} block={false} submitLabel="Salvar" triggerLabel={used ? `Ajustar ${p.name}` : `Usar ${p.name} como trilha`}>
                            <Button component="span" size="compact-xs" variant="light">{used ? "Ajustar" : "Usar"}</Button>
                          </FormSheet>
                        </Group>
                      );
                    })}
                  </Stack>
                  {sp.updatedAt && <Text size="xs" c="dimmed" mt={6}>Atualizado em {sp.updatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}. Capas e nomes vêm do Spotify.</Text>}
                </div>
              )}
            </Stack>
          </Panel>
        )}

        <Panel tone="sun" title="Álbuns e podcasts" icon="headphones">
          {items.length === 0 && <Text size="sm" style={{ opacity: 0.9 }}>{tab === "ouvir" ? "Sua lista para ouvir está vazia." : "Nada marcado como ouvido ainda."}</Text>}
          <SimpleGrid cols={3} spacing="xs">
            {items.map((a) => (
              <FormSheet key={a.id} title="Editar" fields={audioFields} values={{ id: a.id, kind: a.kind, title: a.title, creator: a.creator, status: a.status, rating: a.rating?.replace(".", ","), progress: a.progress, cover_url: a.cover_url, link: a.link, comment: a.comment }} action={saveAudio} remove={deleteAudio}>
                <Box ta="center">
                  <Cover url={a.cover_url} icon={a.kind === "podcast" ? "mic" : "music"} tone="sun" width={92} height={92} radius={16} />
                  <Text size="xs" fw={800} lh={1.2} mt={4} lineClamp={2}>{a.title}</Text>
                  {a.spotify_id && <Text size="10px" c="dimmed">Spotify</Text>}
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
              <div style={{ flex: 1, minWidth: 0 }}><Text fw={800}>{lastPod[0].title}</Text><Text size="sm" style={{ opacity: 0.9 }}>{lastPod[0].progress}</Text></div>
              {lastPod[0].link && <Button component="a" href={lastPod[0].link} target="_blank" rel="noopener noreferrer" size="compact-md" radius="xl" aria-label="Continuar ouvindo" color="lavender.6"><Icon name="play" size={16} /></Button>}
            </Group>
          </Panel>
        )}
      </Stack>
    </>
  );
}
