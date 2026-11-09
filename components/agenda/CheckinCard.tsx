"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Group, Stack, Text, Textarea, UnstyledButton } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import { Panel } from "@/components/ui/Panel";
import { Icon } from "@/lib/icons";
import { saveCheckin } from "@/app/(app)/checkin-actions";
import type { FormState } from "@/lib/agenda/schemas";

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

export function CheckinCard({ initial }: { initial: { mood: number; energy: number; note: string | null } | null }) {
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [energy, setEnergy] = useState<number | null>(initial?.energy ?? null);
  const [state, action, pending] = useActionState<FormState, FormData>(saveCheckin, {});
  const saved = state.ok || (initial !== null && !state.error);
  return (
    <Panel tone="pink" title="Como você está hoje?" icon="mood-4" action={saved ? <Text size="xs" fw={800} c="sage.8">check-in salvo</Text> : undefined}>
      <ActionForm action={action}>
        <Stack gap="sm">
          <Scale name="mood" label="Humor" prefix="mood" value={mood} onChange={setMood} tone="var(--mantine-color-lotus-5)" />
          <Scale name="energy" label="Sua energia" prefix="battery" value={energy} onChange={setEnergy} tone="var(--mantine-color-sage-6)" />
          <Textarea name="note" placeholder="Uma nota rápida (opcional)" defaultValue={initial?.note ?? ""} autosize minRows={1} maxRows={4} maxLength={500} />
          {state.error && <Alert color="red" variant="light">{state.error}</Alert>}
          <Button type="submit" loading={pending} disabled={mood === null || energy === null} variant={saved ? "light" : "filled"}>
            {saved ? "Atualizar check-in" : "Salvar check-in"}
          </Button>
        </Stack>
      </ActionForm>
    </Panel>
  );
}
