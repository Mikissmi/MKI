import { Box, Button, Group, Stack, Text } from "@mantine/core";
import Link from "next/link";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { addDays, localDateKey } from "@/lib/time";
import { fmtDateKey } from "@/lib/format";
import { ACTIVITY_ICONS, ENERGY, MEDIA_KINDS, MEDIA_STATUS, SCREEN } from "@/lib/options";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { LinkButton } from "@/components/LinkButton";
import { TabLinks } from "@/components/ui/TabLinks";
import { Panel, IconTile, Pill, ProgressBar } from "@/components/ui/Panel";
import { Cover, Stars } from "@/components/ui/Cover";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteActivity, deleteActivityLog, deleteMedia, deleteProject, quickLogActivity, saveActivity, saveActivityLog, saveMedia, saveProject } from "./actions";

export const metadata = { title: "Hobbies" };
const TABS = [{ t: "atividades", label: "Atividades", icon: "star" }, { t: "midia", label: "Mídia", icon: "movie" }, { t: "projetos", label: "Projetos", icon: "notebook" }, { t: "historico", label: "Histórico", icon: "clock" }] as const;

const actFields: Field[] = [
  { name: "name", label: "Atividade", required: true, maxLength: 80, placeholder: "Ex.: Desenhar" },
  { name: "icon", label: "Ícone", type: "select", options: ACTIVITY_ICONS.map((i) => ({ value: i.value, label: i.label })) },
  { name: "minutes", label: "Tempo médio (minutos)", type: "decimal", required: true },
  { name: "energy", label: "Energia necessária", type: "select", options: [...ENERGY] },
  { name: "screen_type", label: "Tela", type: "select", options: [...SCREEN] },
  { name: "place", label: "Local", maxLength: 80 }, { name: "tags", label: "Tags (separe por vírgula)" },
];
const mediaFields: Field[] = [
  { name: "kind", label: "Tipo", type: "select", options: MEDIA_KINDS.map((k) => ({ value: k.value, label: k.label.replace(/s$/, "") })) },
  { name: "title", label: "Título", required: true, maxLength: 160 }, { name: "status", label: "Status", type: "select", options: [...MEDIA_STATUS] },
  { name: "platform", label: "Plataforma", maxLength: 60, placeholder: "Netflix, Steam..." }, { name: "progress", label: "Progresso", maxLength: 60, placeholder: "T2 E5 / fase 3" },
  { name: "rating", label: "Nota (1 a 5)", type: "decimal" }, { name: "cover_url", label: "Link da capa", type: "url" },
];
const projectFields: Field[] = [
  { name: "name", label: "Nome do projeto", required: true, maxLength: 100 }, { name: "description", label: "Descrição", type: "textarea", maxLength: 500 },
  { name: "progress", label: "Progresso manual (%) — usado se não houver etapas", type: "decimal" }, { name: "cover_url", label: "Link da imagem", type: "url" }, { name: "notes", label: "Notas", type: "textarea" },
];
const logFields: Field[] = [{ name: "duration_min", label: "Duração (minutos)", type: "decimal", required: true }, { name: "date", label: "Data", type: "date", required: true }, { name: "comment", label: "Comentário", maxLength: 300 }];

const EnergyBars = ({ level }: { level: string }) => {
  const n = level === "baixa" ? 1 : level === "media" ? 2 : 3;
  return <span aria-hidden style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 12 }}>{[1, 2, 3].map((i) => <span key={i} style={{ width: 3, height: 4 + i * 3, borderRadius: 2, background: i <= n ? "var(--mantine-color-lotus-5)" : "rgba(0,0,0,0.15)" }} />)}</span>;
};

export default async function HobbiesPage({ searchParams }: { searchParams: Promise<{ t?: string; k?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = TABS.find((x) => x.t === sp.t)?.t ?? "atividades";
  const kind = MEDIA_KINDS.find((k) => k.value === sp.k)?.value ?? "";
  const today = localDateKey();

  const adds = {
    atividades: <AddSheet title="Nova atividade" fields={actFields} values={{ icon: "star", minutes: "30", energy: "media", screen_type: "sem_tela" }} action={saveActivity} />,
    midia: <AddSheet title="Nova mídia" fields={mediaFields} values={{ kind: kind || "filme", status: "quero" }} action={saveMedia} />,
    projetos: <AddSheet title="Novo projeto" fields={projectFields} values={{ progress: "0" }} action={saveProject} />,
    historico: null,
  };

  return (
    <>
      <PageHeader title="Hobbies" back="/mais" action={adds[tab]} />
      <Stack gap="md">
        <TabLinks active={tab} items={TABS.map((x) => ({ key: x.t, label: x.label, icon: x.icon, href: `/hobbies?t=${x.t}` }))} small />

        {tab === "atividades" && await (async () => {
          const rows = await query<{ id: string; name: string; icon: string; minutes: number; energy: string; place: string | null; tags: string[]; screen_type: string; last: string | null; done_today: boolean }>(
            `SELECT a.id, a.name, a.icon, a.minutes, a.energy, a.place, a.tags, a.screen_type, max(l.date)::text AS last, bool_or(l.date = $2::date) AS done_today
               FROM activities a LEFT JOIN activity_logs l ON l.activity_id = a.id WHERE a.user_id = $1 GROUP BY a.id ORDER BY a.created_at`, [user.id, today]);
          return (
            <Stack gap="xs">
              {rows.length === 0 && <Panel tone="plain"><Text size="sm" c="dimmed">Cadastre as atividades de que você gosta, com tempo, energia e se usam tela. Elas alimentam as sugestões do plano do dia.</Text></Panel>}
              {rows.map((a) => {
                const days = a.last ? Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${a.last}T12:00:00Z`).getTime()) / 86_400_000) : null;
                return (
                  <Panel key={a.id} tone="plain" p="sm">
                    <Group wrap="nowrap" gap="sm">
                      <FormSheet title="Editar atividade" fields={actFields} values={{ id: a.id, name: a.name, icon: a.icon, minutes: a.minutes, energy: a.energy, screen_type: a.screen_type, place: a.place, tags: a.tags.join(", ") }} action={saveActivity} remove={deleteActivity}>
                        <Group wrap="nowrap" gap="sm">
                          <IconTile icon={a.icon} tone={a.screen_type === "sem_tela" ? "sage" : "lavender"} size={44} round />
                          <div style={{ minWidth: 0 }}>
                            <Text fw={800} size="sm">{a.name}</Text>
                            <Group gap={8} mt={2}><Group gap={3}><Icon name="clock" size={12} /><Text size="xs">{a.minutes} min</Text></Group><Group gap={4}><EnergyBars level={a.energy} /><Text size="xs">energia {a.energy === "media" ? "média" : a.energy}</Text></Group></Group>
                            <Group gap={6} mt={4}><Pill tone={a.screen_type === "sem_tela" ? "sage" : "lavender"} icon={a.screen_type === "sem_tela" ? "leaf" : "mobile"}>{a.screen_type === "sem_tela" ? "sem tela" : "com tela"}</Pill>{days !== null && <Text size="xs" c="dimmed">{days === 0 ? "feito hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`}</Text>}</Group>
                          </div>
                        </Group>
                      </FormSheet>
                      <form action={quickLogActivity} style={{ marginLeft: "auto" }}>
                        <input type="hidden" name="activity_id" value={a.id} /><input type="hidden" name="duration_min" value={a.minutes} />
                        <Button type="submit" size="compact-sm" variant={a.done_today ? "light" : "filled"} color="sage" aria-label={`${a.done_today ? "Feito" : "Fiz"}: registrar ${a.name} hoje`}>{a.done_today ? "Feito" : "Fiz"}</Button>
                      </form>
                    </Group>
                  </Panel>
                );
              })}
            </Stack>
          );
        })()}

        {tab === "midia" && await (async () => {
          const rows = await query<{ id: string; kind: string; title: string; status: string; rating: number | null; platform: string | null; progress: string | null; cover_url: string | null }>(
            "SELECT id, kind, title, status, rating, platform, progress, cover_url FROM media_items WHERE user_id = $1 AND ($2 = '' OR kind = $2) ORDER BY (status = 'em_andamento') DESC, created_at DESC", [user.id, kind]);
          return (
            <Stack gap="xs">
              <Group gap={6}>
                <LinkButton href="/hobbies?t=midia" size="compact-xs" variant={kind === "" ? "filled" : "light"}>Todos</LinkButton>
                {MEDIA_KINDS.map((k) => <LinkButton key={k.value} href={`/hobbies?t=midia&k=${k.value}`} size="compact-xs" variant={kind === k.value ? "filled" : "light"}>{k.label}</LinkButton>)}
              </Group>
              {rows.length === 0 && <Text size="sm" c="dimmed">Nada por aqui ainda. Cadastre filmes, séries, jogos e animes.</Text>}
              {rows.map((m) => (
                <FormSheet key={m.id} title="Editar mídia" fields={mediaFields} values={{ id: m.id, kind: m.kind, title: m.title, status: m.status, platform: m.platform, progress: m.progress, rating: m.rating, cover_url: m.cover_url }} action={saveMedia} remove={deleteMedia}>
                  <Panel tone={m.status === "em_andamento" ? "lavender" : "plain"} p="sm">
                    <Group wrap="nowrap" gap="sm">
                      <Cover url={m.cover_url} icon={m.kind === "jogo" ? "gamepad" : "movie"} tone="lavender" width={64} height={84} />
                      <div style={{ minWidth: 0 }}>
                        <Text size="xs" fw={700} c="lavender.7">{m.status === "em_andamento" ? (m.kind === "jogo" ? "Jogando" : "Assistindo") : MEDIA_STATUS.find((s) => s.value === m.status)?.label}</Text>
                        <Text fw={800}>{m.title}</Text>
                        <Stars value={m.rating} />
                        <Text size="xs" c="dimmed">{[m.platform, m.progress].filter(Boolean).join(" · ")}</Text>
                      </div>
                    </Group>
                  </Panel>
                </FormSheet>
              ))}
            </Stack>
          );
        })()}

        {tab === "projetos" && await (async () => {
          const rows = await query<{ id: string; name: string; description: string | null; notes: string | null; progress: number; cover_url: string | null; steps: string; done: string }>(
            `SELECT p.id, p.name, p.description, p.notes, p.progress, p.cover_url, count(s.id)::text AS steps, count(s.id) FILTER (WHERE s.done)::text AS done
               FROM projects p LEFT JOIN project_steps s ON s.project_id = p.id WHERE p.user_id = $1 GROUP BY p.id ORDER BY p.created_at DESC`, [user.id]);
          return (
            <Stack gap="xs">
              {rows.length === 0 && <Text size="sm" c="dimmed">Crie projetos pessoais com etapas e acompanhe o progresso.</Text>}
              {rows.map((p) => {
                const steps = Number(p.steps), done = Number(p.done);
                const pct = steps > 0 ? Math.round((done / steps) * 100) : p.progress;
                return (
                  <Panel key={p.id} tone="sage" p="sm">
                    <Group wrap="nowrap" gap="sm" align="flex-start">
                      <Link href={`/hobbies/projetos/${p.id}`} aria-label={`Abrir ${p.name}`}><Cover url={p.cover_url} icon="notebook" tone="sage" width={64} height={84} /></Link>
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Text size="xs" fw={700}>Projeto pessoal</Text>
                        <Link href={`/hobbies/projetos/${p.id}`} style={{ textDecoration: "none", color: "inherit" }}><Text fw={800}>{p.name}</Text></Link>
                        <Group gap={8} wrap="nowrap"><Box style={{ flex: 1 }}><ProgressBar value={pct} tone="sage" /></Box><Text size="xs" fw={800}>{pct}%</Text></Group>
                        <Text size="xs" style={{ opacity: 0.9 }}>{steps > 0 ? `${done} de ${steps} etapas` : "Sem etapas ainda"}</Text>
                      </Stack>
                    </Group>
                    <Group gap={6} mt="xs">
                      <LinkButton href={`/hobbies/projetos/${p.id}`} size="compact-xs" color="sage.7">Etapas</LinkButton>
                      <FormSheet title="Editar projeto" fields={projectFields} values={{ id: p.id, name: p.name, description: p.description, notes: p.notes, progress: p.progress, cover_url: p.cover_url }} action={saveProject} remove={deleteProject} block={false}><Button component="span" size="compact-xs" variant="white" color="dark">Editar</Button></FormSheet>
                    </Group>
                  </Panel>
                );
              })}
            </Stack>
          );
        })()}

        {tab === "historico" && await (async () => {
          const [logs, freq] = await Promise.all([
            query<{ id: string; date: string; duration_min: number; comment: string | null; activity_id: string; name: string; icon: string }>(
              "SELECT l.id, l.date::text AS date, l.duration_min, l.comment, l.activity_id, a.name, a.icon FROM activity_logs l JOIN activities a ON a.id = l.activity_id WHERE l.user_id = $1 ORDER BY l.date DESC, l.created_at DESC LIMIT 60", [user.id]),
            query<{ name: string; n: string; min: string }>(
              "SELECT a.name, count(*)::text AS n, sum(l.duration_min)::text AS min FROM activity_logs l JOIN activities a ON a.id = l.activity_id WHERE l.user_id = $1 AND l.date >= $2::date GROUP BY a.name ORDER BY count(*) DESC", [user.id, addDays(today, -29)]),
          ]);
          const byDay = new Map<string, typeof logs>();
          for (const l of logs) byDay.set(l.date, [...(byDay.get(l.date) ?? []), l]);
          return (<>
            <Panel tone="lavender" title="Frequência nos últimos 30 dias" icon="chart">
              <Stack gap={4}>{freq.length === 0 && <Text size="sm" style={{ opacity: 0.9 }}>Registre atividades com o botão "Fiz" para ver a frequência.</Text>}
                {freq.map((f) => <Group key={f.name} justify="space-between"><Text size="sm">{f.name}</Text><Text size="sm" fw={800}>{f.n}x · {f.min} min</Text></Group>)}</Stack>
            </Panel>
            {[...byDay.entries()].map(([d, list]) => (
              <Panel key={d} tone="plain" title={fmtDateKey(d)} icon="calendar" p="sm">
                <Stack gap={6}>{list.map((l) => (
                  <FormSheet key={l.id} title={`Editar: ${l.name}`} fields={logFields} values={{ id: l.id, duration_min: l.duration_min, date: l.date, comment: l.comment }} hidden={{ activity_id: l.activity_id }} action={saveActivityLog} remove={deleteActivityLog}>
                    <Group gap="xs" wrap="nowrap"><IconTile icon={l.icon} tone="sage" size={28} round /><Text size="sm" fw={700}>{l.name}</Text><Text size="xs" c="dimmed">{l.duration_min} min</Text>{l.comment && <Text size="xs" c="dimmed" truncate>· {l.comment}</Text>}</Group>
                  </FormSheet>))}</Stack>
              </Panel>
            ))}
          </>);
        })()}
      </Stack>
    </>
  );
}
