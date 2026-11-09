import Link from "next/link";
import { Box, Button, Group, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { addDays, localDateKey, startOfWeek } from "@/lib/time";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { TabLinks } from "@/components/ui/TabLinks";
import { Panel, Pill, ProgressBar } from "@/components/ui/Panel";
import { Cover, Stars } from "@/components/ui/Cover";
import { AddSheet, FormSheet } from "@/components/forms/FormSheet";
import { domainOf, progressPct, READING_COLS, readingFields, readingValues, SERIAL_STATUS, type ReadingRow } from "@/lib/reading";
import { deleteReading, logReading, saveReading, setReadingStatus } from "./actions";

export const metadata = { title: "Leituras" };
const TABS = [{ t: "livros", label: "Livros", icon: "book" }, { t: "artigos", label: "Artigos", icon: "news" }, { t: "obras", label: "Obras em andamento", icon: "bookmark" }] as const;

const logFields = [{ name: "pages", label: "Páginas lidas", type: "decimal" as const, required: true }, { name: "minutes", label: "Tempo (minutos, opcional)", type: "decimal" as const }];

export default async function ReadingPage({ searchParams }: { searchParams: Promise<{ t?: string; q?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((x) => x.t === sp.t)?.t ?? "livros";
  const kind = tab === "livros" ? "livro" : tab === "artigos" ? "artigo" : "obra";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const today = localDateKey();
  const weekStart = startOfWeek(today);
  const settings = await getSettings(user.id);

  const [items, sessions, booksYear] = await Promise.all([
    query<ReadingRow>(
      `SELECT ${READING_COLS} FROM reading_items WHERE user_id = $1 AND kind = $2
         AND ($3 = '' OR title ILIKE '%' || $3 || '%' OR author ILIKE '%' || $3 || '%' OR array_to_string(tags, ' ') ILIKE '%' || $3 || '%')
       ORDER BY (status = 'lendo') DESC, created_at DESC`, [user.id, kind, q]),
    queryOne<{ n: string }>("SELECT count(DISTINCT date)::text AS n FROM reading_logs WHERE user_id = $1 AND date BETWEEN $2::date AND $3::date", [user.id, weekStart, addDays(weekStart, 6)]),
    queryOne<{ n: string }>("SELECT count(*)::text AS n FROM reading_items WHERE user_id = $1 AND kind = 'livro' AND status = 'lido' AND finished_on >= $2::date", [user.id, `${today.slice(0, 4)}-01-01`]),
  ]);
  const by = (s: string) => items.filter((i) => i.status === s);
  const goal = settings.readingSessionsPerWeek, done = Number(sessions?.n ?? 0);
  const fields = readingFields(kind);
  /** Livros abrem o detalhe (anotações, histórico, editar); artigos e obras abrem a edição direto. */
  const edit = (r: ReadingRow, children: React.ReactNode) => r.kind === "livro" ? (
    <Link href={`/leituras/${r.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>{children}</Link>
  ) : (
    <FormSheet title="Editar" fields={fields} values={readingValues(r)} hidden={{ kind }} action={saveReading} remove={deleteReading}>{children}</FormSheet>
  );

  return (
    <>
      <PageHeader title="Leituras" action={<AddSheet title={kind === "artigo" ? "Salvar artigo" : kind === "obra" ? "Nova obra" : "Novo livro"} fields={fields} values={{ status: kind === "obra" ? "lendo" : "quero", serial_status: kind === "obra" ? "em_dia" : "" }} hidden={{ kind }} action={saveReading} />} />
      <Stack gap="md">
        <TabLinks active={tab} items={TABS.map((x) => ({ key: x.t, label: x.label, icon: x.icon, href: `/leituras?t=${x.t}` }))} small />
        <form action="/leituras" method="get"><input type="hidden" name="t" value={tab} /><TextInput name="q" defaultValue={q} placeholder="Buscar por título, autor ou tag" leftSection={<Icon name="search" size={16} />} aria-label="Buscar" /></form>

        {kind === "livro" && (<>
          <Panel tone="pink" title="Lendo agora" icon="book2">
            <Stack gap="sm">
              {by("lendo").length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Nenhum livro em andamento. Marque um como "Lendo".</Text>}
              {by("lendo").map((b) => (
                <Box key={b.id}>
                  <Group wrap="nowrap" align="flex-start" gap="sm">
                    <Link href={`/leituras/${b.id}`}><Cover url={b.cover_url} icon="book" width={84} height={116} /></Link>
                    <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/leituras/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}><Text fw={800} lh={1.2}>{b.title}</Text></Link>
                      {b.author && <Text size="xs" style={{ opacity: 0.75 }}>{b.author}</Text>}
                      {b.total_pages ? (<><Text size="xs">Página {b.current_page ?? 0} de {b.total_pages}</Text><Group gap={8} wrap="nowrap"><Box style={{ flex: 1 }}><ProgressBar value={progressPct(b)} /></Box><Text size="xs" fw={800}>{progressPct(b)}%</Text></Group></>) : <Text size="xs" style={{ opacity: 0.75 }}>Informe o total de páginas para ver o progresso.</Text>}
                      <Group gap={6} mt={2}>
                        <FormSheet title="Registrar leitura" fields={logFields} hidden={{ item_id: b.id }} action={logReading} submitLabel="Registrar" block={false}><Button component="span" size="compact-sm" leftSection="+">Registrar leitura</Button></FormSheet>
                        <FormSheet title="Editar" fields={fields} values={readingValues(b)} hidden={{ kind }} action={saveReading} remove={deleteReading} block={false}><Button component="span" size="compact-sm" variant="white" color="gray">Editar</Button></FormSheet>
                      </Group>
                    </Stack>
                  </Group>
                </Box>
              ))}
            </Stack>
          </Panel>

          <Panel tone="plain" title="Quero ler" icon="bookmark">
            <Stack gap={8}>
              {by("quero").length === 0 && <Text size="sm" c="dimmed">Sua fila está vazia. Ela alimenta as sugestões do plano do dia.</Text>}
              {by("quero").map((b) => edit(b, (
                <Group wrap="nowrap" gap="sm"><Cover url={b.cover_url} icon="book" width={40} height={54} radius={8} /><div style={{ flex: 1, minWidth: 0 }}><Text size="sm" fw={700} truncate>{b.title}</Text>{b.author && <Text size="xs" c="dimmed" truncate>{b.author}</Text>}</div><Icon name="bookmark" size={20} color="var(--mantine-color-sage-6)" /></Group>
              )))}
            </Stack>
          </Panel>

          <Panel tone="sage" title="Meta de leitura da semana" icon="trophy">
            <Text fw={800} fz={20}>{done} de {goal} sessões</Text>
            <Group gap={4} my={8} grow>{Array.from({ length: Math.min(goal, 14) }, (_, i) => <Box key={i} h={10} style={{ borderRadius: 6, background: i < done ? "var(--mantine-color-sage-6)" : "var(--mantine-color-sage-2)" }} />)}</Group>
            <Text size="xs" style={{ opacity: 0.8 }}>Livros lidos neste ano: {booksYear?.n ?? 0} de {settings.readingBooksPerYear}.</Text>
          </Panel>

          {(by("lido").length > 0 || by("abandonado").length > 0) && (
            <Panel tone="plain" title="Lidos e abandonados" icon="check">
              <Stack gap={8}>{[...by("lido"), ...by("abandonado")].map((b) => edit(b, (
                <Group justify="space-between" wrap="nowrap"><Text size="sm" fw={600} truncate>{b.title}</Text><Group gap={6} wrap="nowrap">{b.status === "abandonado" ? <Pill tone="plain">abandonado</Pill> : <Stars value={b.rating} />}</Group></Group>
              )))}</Stack>
            </Panel>
          )}
        </>)}

        {kind === "artigo" && (<>
          <Panel tone="plain" title="Para ler depois" icon="news">
            <Stack gap="xs">
              {by("quero").length === 0 && <Text size="sm" c="dimmed">Cole um link no botão Novo, ou use o botão + em qualquer tela. O título vem automático.</Text>}
              {by("quero").map((a) => (
                <Box key={a.id} p="xs" style={{ border: "1px solid light-dark(#f0e4d2, var(--mantine-color-dark-4))", borderRadius: 16 }}>
                  <Group wrap="nowrap" align="flex-start" gap="sm">
                    {a.cover_url && <Cover url={a.cover_url} width={52} height={52} radius={10} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}><Text size="sm" fw={800} lh={1.25}>{a.title}</Text></a>
                      <Text size="xs" c="dimmed">{domainOf(a.url)}{a.minutes_hint ? ` · ${a.minutes_hint} min` : ""}{a.source === "noticia" ? " · de Notícias" : ""}</Text>
                      {a.tags.length > 0 && <Group gap={4} mt={4}>{a.tags.map((t) => <Pill key={t} tone="lavender">{t}</Pill>)}</Group>}
                    </div>
                  </Group>
                  <Group gap={6} mt="xs">
                    <form action={setReadingStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="lido" /><Button type="submit" size="compact-xs" color="sage.7">Marcar como lido</Button></form>
                    <form action={setReadingStatus}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value="arquivado" /><Button type="submit" size="compact-xs" variant="light" color="gray">Arquivar</Button></form>
                    {edit(a, <Button component="span" size="compact-xs" variant="subtle" color="gray">Editar</Button>)}
                  </Group>
                </Box>
              ))}
            </Stack>
          </Panel>
          {(by("lido").length > 0 || by("arquivado").length > 0) && (
            <Panel tone="sage" title="Lidos e arquivados" icon="check"><Stack gap={6}>{[...by("lido"), ...by("arquivado")].map((a) => edit(a, <Group justify="space-between" wrap="nowrap"><Text size="sm" truncate>{a.title}</Text><Pill tone="sage">{a.status === "lido" ? "lido" : "arquivado"}</Pill></Group>))}</Stack></Panel>
          )}
        </>)}

        {kind === "obra" && (
          <Panel tone="plain" title="Fanfics, web novels e mangás" icon="bookmark">
            <Stack gap="xs">
              {items.length === 0 && <Text size="sm" c="dimmed">Acompanhe obras em andamento: último capítulo, link para continuar e a situação.</Text>}
              {items.map((o) => (
                <Box key={o.id} p="xs" style={{ border: "1px solid light-dark(#f0e4d2, var(--mantine-color-dark-4))", borderRadius: 16 }}>
                  <Group wrap="nowrap" gap="sm" align="flex-start">
                    <Cover url={o.cover_url} icon="bookmark" width={48} height={64} radius={10} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" fw={800}>{o.title}</Text>
                      <Text size="xs" c="dimmed">{o.last_chapter ? `Último capítulo: ${o.last_chapter}` : "Sem capítulo registrado"}</Text>
                      <Group gap={4} mt={4}>
                        {o.serial_status && <Pill tone={o.serial_status === "em_dia" ? "sage" : o.serial_status === "aguardando" ? "sun" : "lavender"}>{SERIAL_STATUS.find((s) => s.value === o.serial_status)?.label}</Pill>}
                        {o.status === "lido" && <Pill tone="pink">concluída</Pill>}
                      </Group>
                    </div>
                  </Group>
                  <Group gap={6} mt="xs">
                    {o.url && <Button component="a" href={o.url} target="_blank" rel="noopener noreferrer" size="compact-xs" rightSection={<Icon name="external" size={12} />}>Continuar</Button>}
                    {edit(o, <Button component="span" size="compact-xs" variant="light" color="gray">Atualizar</Button>)}
                  </Group>
                </Box>
              ))}
            </Stack>
          </Panel>
        )}
        <SimpleGrid cols={1}><Text size="xs" c="dimmed" ta="center">{q ? `Busca por "${q}".` : ""}</Text></SimpleGrid>
      </Stack>
    </>
  );
}
