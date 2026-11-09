"use client";

import { useState, useTransition } from "react";
import { Group, SegmentedControl, Switch, Text, useMantineColorScheme } from "@mantine/core";
import { setFlag } from "@/app/(app)/configuracoes/actions";

/** Interruptor que salva na hora (como nos protótipos). */
export function FlagSwitch({ name, label, description, checked }: { name: string; label: string; description?: string; checked: boolean }) {
  const [on, setOn] = useState(checked);
  const [pending, start] = useTransition();
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <div style={{ minWidth: 0 }}><Text size="sm" fw={600}>{label}</Text>{description && <Text size="xs" c="dimmed">{description}</Text>}</div>
      <Switch aria-label={label} checked={on} disabled={pending} color="lotus" onChange={(e) => { const v = e.currentTarget.checked; setOn(v); start(async () => { await setFlag(name, v); }); }} />
    </Group>
  );
}

export function ThemeSwitch() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <SegmentedControl fullWidth value={colorScheme} onChange={(v) => setColorScheme(v as "light" | "dark" | "auto")} aria-label="Tema"
      data={[{ value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }, { value: "auto", label: "Automático" }]} />
  );
}
