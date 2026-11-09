import Link from "next/link";
import { Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { addDays, localDateKey, startOfWeek } from "@/lib/time";
import { CREATIVE_KINDS } from "@/lib/options";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { Cover } from "@/components/ui/Cover";
import { CreativeTimer } from "@/components/CreativeTimer";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { projectFields } from "@/lib/creative";
import { deleteInspiration, drawChallenge, saveInspiration, saveProject, toggleChallenge } from "./actions";

export const metadata = { title: "Estúdio criativo" };

export default async function StudioPage() {
  const user = await requireUser();
  const today = localDateKey();
  const week = startOfWeek(today);
  const [projects, inspirations, challenge, sessions] = await Promise.all([
    query<{ id: string; title: string; kind: string; description: string | null; cover_url: string | null }>("SELECT id, title, kind, description, cover_url FROM creative_projects WHERE user_id = $1 ORDER BY created_at DESC", [user.id]),
    query<{ id: string; image_url: string | null; link: string | null; note: string | null; project_id: string | null }>("SELECT id, image_url, link, note, project_id FROM inspirations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 24", [user.id]),
    queryOne<{ text: string; done: boolean }>("SELECT text, done FROM challenges WHERE user_id = $1 AND week_start = $2::date", [user.id, week]),
    query<{ title: string | null; minutes: string }>("SELECT p.title, sum(s.minutes)::text AS minutes FROM creative_sessions s LEFT JOIN creative_projects p ON p.id = s.project_id WHERE s.user_id = $1 AND s.date BETWEEN $2::date AND $3::date GROUP BY p.title ORDER BY sum(s.minutes) DESC", [user.id, week, addDays(week, 6)]),
  ]);
  const inspFields: Field[] = [
    { name: "image_url", label: "Link da imagem", type: "url" }, { name: "link", label: "Link de referência", type: "url" }, { name: "note", label: "Nota", maxLength: 300 },
    { name: "project_id", label: "Projeto (opcional)", type: "select", options: [{ value: "", label: "Nenhum" }, ...projects.map((p) => ({ value: p.id, label: p.title }))] },
  ];
  const total = sessions.reduce((a, s) => a + Number(s.minutes), 0);

  return (
    <>
      <PageHeader title="Estúdio criativo" back="/mais" />
      <Stack gap="md">
        <Panel tone="sage" title="Meus projetos" icon="notebook" action={<AddSheet title="Novo projeto criativo" fields={projectFields} values={{ kind: "desenho" }} action={saveProject} />}>
          {projects.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Reúna desenho, escrita, programação, artesanato ou fotografia: fotos, rascunhos e versões ficam juntos.</Text>}
          <SimpleGrid cols={3} spacing="xs">
            {projects.map((p) => (
              <Link key={p.id} href={`/estudio/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Box ta="center"><Cover url={p.cover_url} icon="palette" tone="sage" width={92} height={110} radius={14} /><Text size="xs" fw={800} lh={1.2} mt={4} lineClamp={2}>{p.title}</Text></Box>
              </Link>
            ))}
          </SimpleGrid>
        </Panel>

        <Panel tone="lavender" title="Inspirações" icon="photo" action={<AddSheet title="Nova inspiração" fields={inspFields} values={{ project_id: "" }} action={saveInspiration} />}>
          {inspirations.length === 0 && <Text size="sm" style={{ opacity: 0.8 }}>Guarde imagens, links e referências (por link).</Text>}
          <SimpleGrid cols={4} spacing={6}>
            {inspirations.map((i) => (
              <FormSheet key={i.id} title="Editar inspiração" fields={inspFields} values={{ id: i.id, image_url: i.image_url, link: i.link, note: i.note, project_id: i.project_id ?? "" }} action={saveInspiration} remove={deleteInspiration}>
                {i.image_url ? <Cover url={i.image_url} width={72} height={72} radius={12} /> : <Box p={6} style={{ width: 72, height: 72, borderRadius: 12, background: "rgba(255,255,255,0.7)", overflow: "hidden" }}><Icon name={i.link ? "link" : "notes"} size={14} /><Text size="10px" lineClamp={3}>{i.note ?? i.link}</Text></Box>}
              </FormSheet>
            ))}
          </SimpleGrid>
        </Panel>

        <SimpleGrid cols={2} spacing="xs">
          <Panel tone="sun" p="sm" title="Desafio da semana" icon="pencil">
            <Text size="sm" fw={700} td={challenge?.done ? "line-through" : undefined}>{challenge?.text ?? "Quer um tema criativo para esta semana?"}</Text>
            <Group gap={6} mt="xs">
              <form action={drawChallenge}><Button type="submit" size="compact-xs" variant="white" color="gray">{challenge ? "Trocar" : "Sortear"}</Button></form>
              {challenge && <form action={toggleChallenge}><Button type="submit" size="compact-xs" color="sage.7" variant={challenge.done ? "filled" : "light"}>{challenge.done ? "Concluído" : "Concluir"}</Button></form>}
            </Group>
          </Panel>
          <Panel tone="lavender" p="sm" title="Sessão" icon="clock"><CreativeTimer projects={projects.map((p) => ({ id: p.id, title: p.title }))} /></Panel>
        </SimpleGrid>

        <Panel tone="plain" title="Tempo criativo na semana" icon="chart">
          <Text fw={800} fz={22}>{total} min</Text>
          <Stack gap={4} mt={4}>{sessions.map((s, i) => <Group key={i} justify="space-between"><Text size="sm">{s.title ?? "Sem projeto"}</Text><Pill tone="lavender">{s.minutes} min</Pill></Group>)}{sessions.length === 0 && <Text size="sm" c="dimmed">Inicie uma sessão para registrar o tempo dedicado a cada projeto.</Text>}</Stack>
        </Panel>
      </Stack>
    </>
  );
}
