import { notFound } from "next/navigation";
import { z } from "zod";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fmtDateKey } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill, ProgressBar } from "@/components/ui/Panel";
import { Cover, Stars } from "@/components/ui/Cover";
import { AddSheet, FormSheet } from "@/components/forms/FormSheet";
import { progressPct, READING_COLS, readingFields, readingValues, type ReadingRow } from "@/lib/reading";
import { deleteNote, deleteReading, logReading, saveNote, saveReading } from "../actions";

export const metadata = { title: "Leitura" };

export default async function ReadingDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const item = await queryOne<ReadingRow>(`SELECT ${READING_COLS} FROM reading_items WHERE id = $1 AND user_id = $2`, [id.data, user.id]);
  if (!item) notFound();
  const [notes, logs] = await Promise.all([
    query<{ id: string; quote: string | null; note: string | null; page: number | null }>("SELECT id, quote, note, page FROM reading_notes WHERE item_id = $1 AND user_id = $2 ORDER BY created_at DESC", [item.id, user.id]),
    query<{ date: string; pages: number; minutes: number | null }>("SELECT date::text AS date, pages, minutes FROM reading_logs WHERE item_id = $1 AND user_id = $2 ORDER BY date DESC, id LIMIT 15", [item.id, user.id]),
  ]);
  const noteFields = [{ name: "quote", label: "Trecho ou citação", type: "textarea" as const }, { name: "note", label: "Minha anotação", type: "textarea" as const }, { name: "page", label: "Página", type: "decimal" as const }];

  return (
    <>
      <PageHeader title="Leitura" back={`/leituras?t=${item.kind === "livro" ? "livros" : item.kind === "artigo" ? "artigos" : "obras"}`} />
      <Stack gap="md">
        <Panel tone="pink">
          <Group wrap="nowrap" align="flex-start" gap="md">
            <Cover url={item.cover_url} icon="book" width={96} height={132} />
            <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={800} fz={20} lh={1.2}>{item.title}</Text>
              {item.author && <Text size="sm" style={{ opacity: 0.8 }}>{item.author}</Text>}
              <Group gap={6}><Pill tone="lavender">{item.status}</Pill><Stars value={item.rating} /></Group>
              {item.total_pages && (<><Text size="xs">Página {item.current_page ?? 0} de {item.total_pages} ({progressPct(item)}%)</Text><ProgressBar value={progressPct(item)} /></>)}
              {item.started_on && <Text size="xs" style={{ opacity: 0.8 }}>Começou em {fmtDateKey(item.started_on)}{item.finished_on ? ` · terminou em ${fmtDateKey(item.finished_on)}` : ""}</Text>}
            </Stack>
          </Group>
          <Group gap={6} mt="sm">
            {item.kind === "livro" && <FormSheet title="Registrar leitura" fields={[{ name: "pages", label: "Páginas lidas", type: "decimal", required: true }, { name: "minutes", label: "Tempo (minutos, opcional)", type: "decimal" }]} hidden={{ item_id: item.id }} action={logReading} submitLabel="Registrar" block={false}><Button component="span" size="compact-sm" leftSection="+">Registrar leitura</Button></FormSheet>}
            <FormSheet title="Editar" fields={readingFields(item.kind)} values={readingValues(item)} hidden={{ kind: item.kind }} action={saveReading} remove={deleteReading} block={false}><Button component="span" size="compact-sm" variant="white" color="gray">Editar</Button></FormSheet>
          </Group>
          {item.review && <Text size="sm" mt="sm" style={{ whiteSpace: "pre-wrap" }}>{item.review}</Text>}
        </Panel>

        <Panel tone="lavender" title="Trechos e anotações" icon="notes" action={<AddSheet title="Nova anotação" fields={noteFields} hidden={{ item_id: item.id }} action={saveNote} />}>
          <Stack gap="xs">
            {notes.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Guarde citações e destaques desta leitura.</Text>}
            {notes.map((n) => (
              <FormSheet key={n.id} title="Editar anotação" fields={noteFields} values={{ id: n.id, quote: n.quote, note: n.note, page: n.page }} hidden={{ item_id: item.id }} action={saveNote} remove={deleteNote}>
                <Box p="xs" style={{ background: "rgba(255,255,255,0.6)", borderRadius: 14 }}>
                  {n.quote && <Text size="sm" fs="italic">"{n.quote}"</Text>}
                  {n.note && <Text size="sm" mt={n.quote ? 4 : 0}>{n.note}</Text>}
                  {n.page !== null && <Text size="xs" c="dimmed" mt={2}>página {n.page}</Text>}
                </Box>
              </FormSheet>
            ))}
          </Stack>
        </Panel>

        {logs.length > 0 && (
          <Panel tone="plain" title="Histórico de leitura" icon="clock">
            <Stack gap={4}>{logs.map((l, i) => <Group key={i} justify="space-between"><Text size="sm">{fmtDateKey(l.date)}</Text><Text size="sm" fw={700}>{l.pages} páginas{l.minutes ? ` · ${l.minutes} min` : ""}</Text></Group>)}</Stack>
          </Panel>
        )}
      </Stack>
    </>
  );
}
