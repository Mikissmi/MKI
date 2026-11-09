import { Box, Button, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { AI_DAILY_LIMIT, getSettings } from "@/lib/settings";
import { aiAvailability, aiUsageToday, lastAiFailure } from "@/lib/planner/service";
import { aiFailureText } from "@/lib/ai/messages";
import { AiTestButton } from "@/components/AiTestButton";
import { ACCENTS } from "@/lib/accent";
import { moneyInput } from "@/lib/format";
import { localDateKey, zonedToUtc, addDays } from "@/lib/time";
import { Icon } from "@/lib/icons";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Pill } from "@/components/ui/Panel";
import { FlagSwitch, ThemeSwitch } from "@/components/SettingsControls";
import { FormSheet, type Field } from "@/components/forms/FormSheet";
import { LogoutButton } from "@/components/LogoutButton";
import { ImportForm } from "@/components/ImportForm";
import { saveAccent, saveGoals, saveProfile } from "./actions";
import { saveHours } from "../agenda/actions";
import { EXPORT_TABLES } from "@/lib/export";

export const metadata = { title: "Configurações" };

const REASON: Record<string, string> = { disabled: "IA desligada", no_key: "sem chave do Gemini", limit: "limite diário", cooldown: "espera após falha", failed: "falha da IA", format: "resposta inválida", manual: "pedido direto" };

export default async function SettingsPage() {
  const user = await requireUser();
  const s = await getSettings(user.id);
  const today = localDateKey();
  const [usage, plans, reasons, avail, failure] = await Promise.all([
    aiUsageToday(user.id, today),
    query<{ n: string }>("SELECT count(*)::text AS n FROM ai_requests WHERE user_id = $1 AND outcome = 'rules' AND created_at >= $2", [user.id, zonedToUtc(addDays(today, -6), 0).toISOString()]),
    query<{ reason: string | null; n: string }>("SELECT reason, count(*)::text AS n FROM ai_requests WHERE user_id = $1 AND outcome = 'rules' AND created_at >= $2 GROUP BY reason ORDER BY count(*) DESC", [user.id, zonedToUtc(addDays(today, -6), 0).toISOString()]),
    aiAvailability(user.id, s),
    lastAiFailure(user.id),
  ]);
  const goalFields: Field[] = [
    { name: "waterGoal", label: "Meta de água (copos por dia)", type: "decimal", required: true },
    { name: "sessions", label: "Meta de leitura (sessões por semana)", type: "decimal", required: true },
    { name: "books", label: "Meta de leitura (livros por ano)", type: "decimal", required: true },
    { name: "budget", label: "Orçamento mensal (R$, opcional)", type: "decimal" },
    { name: "cooldown", label: "Espera após falha da IA (minutos)", type: "decimal", required: true },
  ];

  return (
    <>
      <PageHeader title="Configurações" back="/mais" />
      <Stack gap="md">
        <FormSheet title="Meu perfil" fields={[{ name: "displayName", label: "Como devo te chamar?", maxLength: 40 }]} values={{ displayName: s.displayName ?? "" }} action={saveProfile}>
          <Panel tone="plain"><Group wrap="nowrap" gap="sm"><Box style={{ width: 52, height: 52, borderRadius: 26, display: "grid", placeItems: "center", background: "light-dark(#f8c6d4, rgba(232,93,151,0.35))" }}><Icon name="user" size={26} /></Box>
            <div style={{ flex: 1 }}><Text fw={800}>Meu perfil</Text><Text size="sm" c="dimmed">{s.displayName ?? user.username}</Text></div><Icon name="right" size={20} /></Group></Panel>
        </FormSheet>

        <Panel tone="plain" title="Aparência" icon="palette">
          <Stack gap="sm">
            <ThemeSwitch />
            <div><Text size="sm" fw={600} mb={6}>Cor de destaque</Text>
              <Group gap="sm">{(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map((a) => (
                <form key={a} action={saveAccent}><input type="hidden" name="accent" value={a} />
                  <button type="submit" aria-label={`Cor ${ACCENTS[a].label}`} aria-pressed={s.accent === a} style={{ width: 38, height: 38, borderRadius: 19, border: s.accent === a ? "3px solid var(--mantine-color-text)" : "2px solid transparent", background: ACCENTS[a].scale[5], cursor: "pointer", display: "grid", placeItems: "center", color: "#fff", padding: 0 }}>{s.accent === a && <Icon name="check" size={18} stroke={3} />}</button></form>))}</Group></div>
          </Stack>
        </Panel>

        <Panel tone="plain" title="Rotina" icon="clock">
          <FormSheet title="Horários de acordar e dormir" fields={[{ name: "wake", label: "Acordar", type: "time", required: true }, { name: "sleep", label: "Dormir", type: "time", required: true }]} values={{ wake: s.wake, sleep: s.sleep }} action={saveHours}>
            <Stack gap={8}>
              <Group justify="space-between"><Group gap="xs"><Icon name="sunrise" size={18} /><Text size="sm" fw={600}>Horário de acordar</Text></Group><Pill tone="plain">{s.wake}</Pill></Group>
              <Group justify="space-between"><Group gap="xs"><Icon name="moon" size={18} /><Text size="sm" fw={600}>Horário de dormir</Text></Group><Pill tone="plain">{s.sleep}</Pill></Group>
            </Stack>
          </FormSheet>
          <Button component="a" href="/agenda/rotina" size="compact-xs" variant="subtle" mt="xs">Editar blocos da rotina-modelo</Button>
        </Panel>

        <Panel tone="pink" title="Assistente de IA" icon="robot" action={avail.ok ? <Pill tone="sage">pronta</Pill> : <Pill tone="lavender" icon="lock">modo regras</Pill>}>
          <Stack gap="sm">
            <FlagSwitch name="aiEnabled" label="Assistente de IA" description="Ajuda para organizar seu dia" checked={s.aiEnabled} />
            <Box p="sm" style={{ background: "rgba(255,255,255,0.55)", borderRadius: 16 }}>
              <Text size="sm" fw={800} mb={6}>O que compartilhar com a IA</Text>
              <Stack gap={8}>
                <FlagSwitch name="share.agenda" label="Agenda" checked={s.aiShare.agenda} />
                <FlagSwitch name="share.mood" label="Humor e energia" checked={s.aiShare.mood} />
                <FlagSwitch name="share.diary" label="Diário e anotações" checked={s.aiShare.diary} />
                <FlagSwitch name="share.expenses" label="Gastos" checked={s.aiShare.expenses} />
                <FlagSwitch name="share.health" label="Saúde" checked={s.aiShare.health} />
              </Stack>
              <Text size="xs" mt={6} style={{ opacity: 0.9 }}>No plano gratuito, o Google pode usar o que é enviado para melhorar produtos. Por padrão, diário, gastos e saúde ficam de fora.</Text>
            </Box>
            <SimpleGrid cols={2} spacing="xs">
              <Panel tone="plain" p="sm"><Text size="xs">IA usada hoje</Text><Text fw={800} fz={22}>{usage}<Text span size="sm" c="dimmed"> / {AI_DAILY_LIMIT}</Text></Text></Panel>
              <Panel tone="plain" p="sm"><Text size="xs">Plano B (7 dias)</Text><Text fw={800} fz={22}>{plans[0]?.n ?? 0} <Text span size="sm" c="dimmed">vezes</Text></Text></Panel>
            </SimpleGrid>
            {failure && <Text size="sm" role="alert" fw={600}>Último erro da IA: {aiFailureText(failure.reason, failure.detail)}</Text>}
            <AiTestButton />
            {reasons.length > 0 && <Text size="xs" style={{ opacity: 0.9 }}>Motivos do plano B: {reasons.map((r) => `${REASON[r.reason ?? ""] ?? r.reason ?? "regras"} (${r.n})`).join(", ")}.</Text>}
          </Stack>
        </Panel>

        <Panel tone="plain" title="Metas e limites" icon="target">
          <FormSheet title="Metas e limites" fields={goalFields} values={{ waterGoal: s.waterGoal, sessions: s.readingSessionsPerWeek, books: s.readingBooksPerYear, budget: moneyInput(s.monthlyBudgetCents), cooldown: s.aiCooldownMin }} action={saveGoals}>
            <Stack gap={6}>
              <Group justify="space-between"><Text size="sm">Água</Text><Text size="sm" fw={800}>{s.waterGoal} copos/dia</Text></Group>
              <Group justify="space-between"><Text size="sm">Leitura</Text><Text size="sm" fw={800}>{s.readingSessionsPerWeek} sessões/semana · {s.readingBooksPerYear} livros/ano</Text></Group>
              <Group justify="space-between"><Text size="sm">Orçamento mensal</Text><Text size="sm" fw={800}>{s.monthlyBudgetCents ? `R$ ${moneyInput(s.monthlyBudgetCents)}` : "não definido"}</Text></Group>
              <Group justify="space-between"><Text size="sm">Espera após falha da IA</Text><Text size="sm" fw={800}>{s.aiCooldownMin} min</Text></Group>
            </Stack>
          </FormSheet>
        </Panel>

        <Panel tone="plain" title="Avisos" icon="bell">
          <Stack gap="sm">
            <FlagSwitch name="retroNotice" label="Aviso de retrospectiva pronta" description="Aparece na tela Hoje" checked={s.retroNotice} />
            <FlagSwitch name="screenBreakReminder" label="Lembrete de pausa sem tela" description="Depois de muito tempo de tela registrado" checked={s.screenBreakReminder} />
          </Stack>
        </Panel>

        <Panel tone="lavender" title="Seus dados" icon="download">
          <Stack gap="sm">
            <Button component="a" href="/api/export?format=json" download size="md" variant="white" color="lavender.7" leftSection={<Icon name="upload" size={18} />}>Exportar tudo (JSON)</Button>
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Exportar uma tabela em CSV</summary>
              <Group gap={6} mt="xs">{EXPORT_TABLES.map((t) => <Button key={t.table} component="a" href={`/api/export?format=csv&table=${t.table}`} download size="compact-xs" variant="light" color="lavender">{t.label}</Button>)}</Group>
            </details>
            <ImportForm />
          </Stack>
        </Panel>

        <LogoutButton />
      </Stack>
    </>
  );
}
