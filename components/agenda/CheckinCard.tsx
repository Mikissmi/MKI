"use client";

import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Collapse, Group, Stack, Text, Textarea, UnstyledButton } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { ActionForm } from "@/components/ActionForm";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/lib/icons";
import { saveCheckin } from "@/app/(app)/checkin-actions";
import type { FormState } from "@/lib/agenda/schemas";

const MOOD_LABEL = ["", "muito mal", "mal", "mais ou menos", "bem", "muito bem"];

function Scale({ name, label, prefix, value, onChange, tone }: { name: string; label: string; prefix: string; value: number | null; onChange: (n: number) => void; tone: string }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <Text size="sm" fw={700} mb={4}>{label}</Text>
      <input type="hidden" name={name} value={value ?? ""} />
      <Group gap={6} grow wrap="nowrap">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <UnstyledButton
              key={n} role="radio" aria-checked={on} aria-label={`${label} ${n} de 5`} onClick={() => onChange(n)}
              style={{
                display: "grid", placeItems: "center", height: 46, borderRadius: 16,
                background: on ? tone : "light-dark(rgba(255,255,255,0.7), rgba(255,255,255,0.06))",
                color: on ? "#fff" : "var(--mantine-color-dimmed)",
                border: `2px solid ${on ? tone : "light-dark(#f3d9de, var(--mantine-color-dark-4))"}`,
              }}
            >
              <Icon name={`${prefix}-${n}`} size={26} />
            </UnstyledButton>
          );
        })}
      </Group>
    </div>
  );
}

/**
 * Check-in do dia. Depois de respondido encolhe para um selo com os dois ícones; tocar no selo reabre.
 * O estado vem do banco (existe check-in hoje = recolhido), então vale ao recarregar e em outro aparelho,
 * e no dia seguinte, sem check-in, o card volta cheio.
 */
export function CheckinCard({ initial }: { initial: { mood: number; energy: number; note: string | null } | null }) {
  const reduceMotion = useReducedMotion();
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [expanded, setExpanded] = useState(initial === null);
  const [state, action, pending] = useActionState<FormState, FormData>(saveCheckin, {});
  const saved = state.ok || (initial !== null && !state.error);
  const answered = saved && mood !== null && energy !== null;
  const ms = reduceMotion ? 0 : 220;

  // ao salvar (novo ou alterado) o card recolhe de novo; o servidor atualiza o mesmo registro do dia
  useEffect(() => { if (state.ok) setExpanded(false); }, [state]);

  const collapse = () => { setMood(initial?.mood ?? mood); setEnergy(initial?.energy ?? energy); setExpanded(false); };

  return (
    <div>
      <Collapse expanded={answered && !expanded} transitionDuration={ms}>
        <Group justify="flex-end" pb="xs">
          <UnstyledButton
            onClick={() => setExpanded(true)} aria-expanded={false}
            aria-label={`Humor: ${MOOD_LABEL[mood ?? 0]}, energia: ${energy}. Toque para alterar`}
            style={{ minHeight: 44, minWidth: 44, padding: "0 14px", borderRadius: 22, display: "flex", alignItems: "center", gap: 10, background: "light-dark(#fde8e8, rgba(232,93,151,0.2))", border: "1px solid light-dark(#f8d3d9, rgba(232,93,151,0.3))", color: "light-dark(#7a2448, #f8bad3)" }}
          >
            {mood !== null && <Icon name={`mood-${mood}`} size={24} />}
            {energy !== null && <Icon name={`battery-${energy}`} size={24} />}
          </UnstyledButton>
        </Group>
      </Collapse>

      <Collapse expanded={expanded || !answered} transitionDuration={ms}>
        <Panel tone="pink" title="Como você está hoje?" icon="mood-4" action={answered ? <Button size="compact-xs" variant="subtle" color="dark" onClick={collapse} aria-label="Recolher o check-in">Recolher</Button> : undefined}>
          <ActionForm action={action}>
            <Stack gap="sm">
              <Scale name="mood" label="Humor" prefix="mood" value={mood} onChange={setMood} tone="var(--mantine-color-lotus-6)" />
              <Scale name="energy" label="Sua energia" prefix="battery" value={energy} onChange={setEnergy} tone="var(--mantine-color-sage-7)" />
              <Textarea name="note" placeholder="Uma nota rápida (opcional)" defaultValue={initial?.note ?? ""} autosize minRows={1} maxRows={4} maxLength={500} />
              {state.error && <Alert color="red" variant="light">{state.error}</Alert>}
              <Button type="submit" loading={pending} disabled={mood === null || energy === null} variant={saved ? "light" : "filled"}>
                {saved ? "Atualizar check-in" : "Salvar check-in"}
              </Button>
            </Stack>
          </ActionForm>
        </Panel>
      </Collapse>
    </div>
  );
}
