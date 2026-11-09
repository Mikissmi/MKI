"use client";

import { ActionForm } from "@/components/ActionForm";
import { useActionState, useState } from "react";
import { Alert, Button, Card, Group, Stack, Text, Textarea, UnstyledButton } from "@mantine/core";
import { saveCheckin } from "@/app/(app)/checkin-actions";
import type { FormState } from "@/lib/agenda/schemas";

const MOODS = ["😣", "😕", "😐", "🙂", "😄"];
const ENERGY = ["🪫", "😴", "🙂", "💪", "⚡"];

function Scale({ name, label, icons, value, onChange }: { name: string; label: string; icons: string[]; value: number | null; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <Text size="sm" fw={700} mb={4}>{label}</Text>
      <input type="hidden" name={name} value={value ?? ""} />
      <Group gap="xs" grow>
        {icons.map((icon, i) => {
          const n = i + 1, on = value === n;
          return (
            <UnstyledButton
              key={n} role="radio" aria-checked={on} aria-label={`${label} ${n} de 5`} onClick={() => onChange(n)}
              style={{
                fontSize: 26, textAlign: "center", padding: "8px 0", borderRadius: "var(--mantine-radius-lg)",
                background: on ? "var(--mantine-color-lotus-1)" : "transparent",
                border: `2px solid ${on ? "var(--mantine-color-lotus-5)" : "var(--mantine-color-default-border)"}`,
              }}
            >{icon}</UnstyledButton>
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
    <Card>
      <ActionForm action={action}>
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={800}>Como você está hoje?</Text>
            {saved && <Text size="xs" c="sage.7" fw={700}>check-in salvo ✓</Text>}
          </Group>
          <Scale name="mood" label="Humor" icons={MOODS} value={mood} onChange={setMood} />
          <Scale name="energy" label="Energia" icons={ENERGY} value={energy} onChange={setEnergy} />
          <Textarea name="note" placeholder="Uma nota rápida (opcional)" defaultValue={initial?.note ?? ""} autosize minRows={1} maxRows={4} maxLength={500} />
          {state.error && <Alert color="red" variant="light">{state.error}</Alert>}
          {energy !== null && energy <= 2 && <Text size="xs" c="dimmed">Energia baixa: o Dia leve chega na etapa 4. Vá com calma hoje 🌿</Text>}
          <Button type="submit" loading={pending} disabled={mood === null || energy === null} variant={saved ? "light" : "filled"}>
            {saved ? "Atualizar check-in" : "Salvar check-in"}
          </Button>
        </Stack>
      </ActionForm>
    </Card>
  );
}
