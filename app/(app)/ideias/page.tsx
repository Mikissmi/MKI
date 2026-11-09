import { Button, Group, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { fmtDateKey } from "@/lib/format";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { addIdea, deleteIdea, toggleIdea } from "./actions";

export const metadata = { title: "Caixa de ideias" };

export default async function IdeasPage() {
  const user = await requireUser();
  const ideas = await query<{ id: string; text: string; done: boolean; day: string }>("SELECT id, text, done, created_at::date::text AS day FROM ideas WHERE user_id = $1 ORDER BY done, created_at DESC", [user.id]);
  return (
    <>
      <PageHeader title="Caixa de ideias" back="/mais" />
      <Stack gap="md">
        <Panel tone="pink" title="Nova ideia" icon="bulb">
          <form action={addIdea}><Group gap="xs" wrap="nowrap" align="flex-end"><input name="text" required maxLength={500} placeholder="Uma ideia, um projeto, uma vontade..." aria-label="Nova ideia" style={{ flex: 1, height: 42, borderRadius: 21, border: "1px solid #f3d9de", padding: "0 16px", background: "rgba(255,255,255,0.8)", color: "inherit" }} /><Button type="submit" aria-label="Guardar ideia">Guardar</Button></Group></form>
        </Panel>
        <Panel tone="plain">
          <Stack gap={10}>
            {ideas.length === 0 && <Text size="sm" c="dimmed">Sem ideias por enquanto. Use o botão + em qualquer tela para guardar uma rapidinho.</Text>}
            {ideas.map((i) => (
              <Group key={i.id} gap="sm" wrap="nowrap" align="flex-start">
                <form action={toggleIdea}><input type="hidden" name="id" value={i.id} />
                  <button type="submit" aria-pressed={i.done} aria-label={i.done ? "Marcar como pendente" : "Marcar como feita"} style={{ width: 26, height: 26, borderRadius: 9, border: "2px solid var(--mantine-color-lotus-4)", background: i.done ? "var(--mantine-color-lotus-5)" : "transparent", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>{i.done && <Icon name="check" size={16} stroke={3} />}</button></form>
                <div style={{ flex: 1, minWidth: 0 }}><Text size="sm" td={i.done ? "line-through" : undefined} c={i.done ? "dimmed" : undefined} style={{ whiteSpace: "pre-wrap" }}>{i.text}</Text><Text size="xs" c="dimmed">{fmtDateKey(i.day)}</Text></div>
                <form action={deleteIdea}><input type="hidden" name="id" value={i.id} /><Button type="submit" size="compact-xs" variant="subtle" color="dark" aria-label="Excluir ideia"><Icon name="trash" size={14} /></Button></form>
              </Group>
            ))}
          </Stack>
        </Panel>
      </Stack>
    </>
  );
}
