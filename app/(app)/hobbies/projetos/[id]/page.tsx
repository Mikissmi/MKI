import { notFound } from "next/navigation";
import { z } from "zod";
import { Group, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/PageHeader";
import { Panel, ProgressBar } from "@/components/ui/Panel";
import { Icon } from "@/lib/icons";
import { Cover } from "@/components/ui/Cover";
import { AddSheet, FormSheet } from "@/components/forms/FormSheet";
import { deleteStep, saveStep, toggleStep } from "../../actions";

export const metadata = { title: "Projeto" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const p = await queryOne<{ id: string; name: string; description: string | null; notes: string | null; progress: number; cover_url: string | null }>("SELECT id, name, description, notes, progress, cover_url FROM projects WHERE id = $1 AND user_id = $2", [id.data, user.id]);
  if (!p) notFound();
  const steps = await query<{ id: string; title: string; done: boolean }>("SELECT id, title, done FROM project_steps WHERE project_id = $1 AND user_id = $2 ORDER BY position, id", [p.id, user.id]);
  const done = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : p.progress;
  const fields = [{ name: "title", label: "Etapa", required: true, maxLength: 160 }];
  return (
    <>
      <PageHeader title={p.name} back="/hobbies?t=projetos" />
      <Stack gap="md">
        <Panel tone="sage">
          <Group wrap="nowrap" gap="md" align="flex-start">
            <Cover url={p.cover_url} icon="notebook" tone="sage" width={80} height={104} />
            <Stack gap={6} style={{ flex: 1 }}>
              {p.description && <Text size="sm">{p.description}</Text>}
              <Group gap={8} wrap="nowrap"><div style={{ flex: 1 }}><ProgressBar value={pct} tone="sage" /></div><Text size="sm" fw={800}>{pct}%</Text></Group>
              <Text size="xs">{steps.length ? `${done} de ${steps.length} etapas` : "Adicione etapas para o progresso ser calculado sozinho."}</Text>
            </Stack>
          </Group>
        </Panel>
        <Panel tone="plain" title="Etapas" icon="list" action={<AddSheet title="Nova etapa" fields={fields} hidden={{ project_id: p.id }} action={saveStep} />}>
          <Stack gap={8}>
            {steps.map((s) => (
              <Group key={s.id} wrap="nowrap" gap="sm">
                <form action={toggleStep}><input type="hidden" name="id" value={s.id} />
                  <button type="submit" aria-pressed={s.done} aria-label={s.done ? "Desmarcar etapa" : "Concluir etapa"} style={{ width: 26, height: 26, borderRadius: 8, border: "2px solid var(--mantine-color-sage-5)", background: s.done ? "var(--mantine-color-sage-6)" : "transparent", color: "#fff", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}>{s.done && <Icon name="check" size={16} stroke={3} />}</button></form>
                <FormSheet title="Editar etapa" fields={fields} values={{ id: s.id, title: s.title }} hidden={{ project_id: p.id }} action={saveStep} remove={deleteStep}>
                  <Text size="sm" td={s.done ? "line-through" : undefined} c={s.done ? "dimmed" : undefined}>{s.title}</Text>
                </FormSheet>
              </Group>
            ))}
            {steps.length === 0 && <Text size="sm" c="dimmed">Sem etapas.</Text>}
          </Stack>
        </Panel>
        {p.notes && <Panel tone="plain" title="Notas" icon="notes"><Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{p.notes}</Text></Panel>}
      </Stack>
    </>
  );
}
