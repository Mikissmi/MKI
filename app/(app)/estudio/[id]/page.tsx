import { notFound } from "next/navigation";
import { z } from "zod";
import { Button, Group, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { localDateKey } from "@/lib/time";
import { fmtDateKey } from "@/lib/format";
import { CREATIVE_KINDS } from "@/lib/options";
import { projectFields } from "@/lib/creative";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteEntry, deleteProject, saveEntry, saveProject } from "../actions";

export const metadata = { title: "Projeto criativo" };

export default async function CreativeProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const p = await queryOne<{ id: string; title: string; kind: string; description: string | null; cover_url: string | null }>("SELECT id, title, kind, description, cover_url FROM creative_projects WHERE id = $1 AND user_id = $2", [id.data, user.id]);
  if (!p) notFound();
  const [entries, time] = await Promise.all([
    query<{ id: string; title: string; image_url: string | null; note: string | null; date: string }>("SELECT id, title, image_url, note, date::text AS date FROM creative_entries WHERE project_id = $1 AND user_id = $2 ORDER BY date DESC, created_at DESC", [p.id, user.id]),
    queryOne<{ n: string; m: string | null }>("SELECT count(*)::text AS n, sum(minutes)::text AS m FROM creative_sessions WHERE project_id = $1 AND user_id = $2", [p.id, user.id]),
  ]);
  const fields: Field[] = [{ name: "title", label: "Título (ex.: versão 2, rascunho)", required: true, maxLength: 120 }, { name: "date", label: "Data", type: "date", required: true }, { name: "image_url", label: "Link da foto ou imagem", type: "url" }, { name: "note", label: "Nota", type: "textarea" }];
  return (
    <>
      <PageHeader title={p.title} back="/estudio" />
      <Stack gap="md">
        <Panel tone="sage">
          <Group wrap="nowrap" align="flex-start" gap="md">
            <Cover url={p.cover_url} icon="palette" tone="sage" width={90} height={110} />
            <Stack gap={6} style={{ flex: 1 }}>
              <Group gap={6}><Pill tone="sage">{CREATIVE_KINDS.find((k) => k.value === p.kind)?.label}</Pill></Group>
              {p.description && <Text size="sm">{p.description}</Text>}
              <Text size="xs">{time?.n ?? 0} sessões · {time?.m ?? 0} min no total</Text>
              <FormSheet title="Editar projeto" fields={projectFields} values={{ id: p.id, title: p.title, kind: p.kind, description: p.description, cover_url: p.cover_url }} action={saveProject} remove={deleteProject} block={false}><Button component="span" size="compact-sm" variant="white" color="dark">Editar</Button></FormSheet>
            </Stack>
          </Group>
        </Panel>
        <Panel tone="plain" title="Rascunhos e versões" icon="photo" action={<AddSheet title="Nova versão" fields={fields} values={{ date: localDateKey() }} hidden={{ project_id: p.id }} action={saveEntry} />}>
          <Stack gap="sm">
            {entries.length === 0 && <Text size="sm" c="dimmed">Registre o andamento: fotos de rascunhos, versões e anotações.</Text>}
            {entries.map((e) => (
              <FormSheet key={e.id} title="Editar" fields={fields} values={{ id: e.id, title: e.title, date: e.date, image_url: e.image_url, note: e.note }} hidden={{ project_id: p.id }} action={saveEntry} remove={deleteEntry}>
                <Group wrap="nowrap" align="flex-start" gap="sm">{e.image_url && <Cover url={e.image_url} width={72} height={72} radius={12} />}<div><Text size="sm" fw={800}>{e.title}</Text><Text size="xs" c="dimmed">{fmtDateKey(e.date)}</Text>{e.note && <Text size="sm">{e.note}</Text>}</div></Group>
              </FormSheet>
            ))}
          </Stack>
        </Panel>
      </Stack>
    </>
  );
}
