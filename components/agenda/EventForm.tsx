"use client";

import { ActionForm } from "@/components/ActionForm";
import { useActionState } from "react";
import { Alert, Button, Group, NativeSelect, Stack, TextInput, Textarea } from "@mantine/core";
import { saveEvent } from "@/app/(app)/agenda/actions";
import { CATEGORIES } from "@/lib/agenda/categories";
import { fmtDuration } from "@/lib/time";
import type { FormState } from "@/lib/agenda/schemas";

export type EventDefaults = {
  id?: string; title: string; date: string; time: string; duration: number; location: string; category: string;
  recurrence: string; until: string; remind: string; notes: string;
};

const BASE_DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const durations = (current: number) =>
  (BASE_DURATIONS.includes(current) || !current ? BASE_DURATIONS : [...BASE_DURATIONS, current].sort((a, b) => a - b))
    .map((m) => ({ value: String(m), label: fmtDuration(m) }));

export function EventForm({ defaults }: { defaults: EventDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEvent, {});
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={defaults.id ?? ""} />
      <Stack>
        {state.error && !state.fieldErrors && <Alert color="red" variant="light">{state.error}</Alert>}
        <TextInput name="title" label="Título" defaultValue={defaults.title} error={err("title")} required maxLength={120} />
        <Group grow align="flex-start">
          <TextInput name="date" label="Data" type="date" defaultValue={defaults.date} error={err("date")} required />
          <TextInput name="time" label="Horário" type="time" defaultValue={defaults.time} error={err("time")} required />
        </Group>
        <NativeSelect
          name="duration" label="Duração" defaultValue={String(defaults.duration)} error={err("duration")}
          data={durations(defaults.duration)}
        />
        <TextInput name="location" label="Local" defaultValue={defaults.location} maxLength={160} />
        <NativeSelect name="category" label="Categoria" defaultValue={defaults.category} data={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
        <Group grow align="flex-start">
          <NativeSelect name="recurrence" label="Repetir" defaultValue={defaults.recurrence}
            data={[{ value: "none", label: "Não repete" }, { value: "daily", label: "Todo dia" }, { value: "weekly", label: "Toda semana" }, { value: "monthly", label: "Todo mês" }]} />
          <TextInput name="until" label="Repetir até" type="date" defaultValue={defaults.until} error={err("until")} description="opcional" />
        </Group>
        <NativeSelect name="remind" label="Lembrete (com o app aberto)" defaultValue={defaults.remind}
          data={[{ value: "", label: "Sem lembrete" }, { value: "0", label: "Na hora" }, { value: "10", label: "10 min antes" }, { value: "30", label: "30 min antes" }, { value: "60", label: "1 hora antes" }]} />
        <Textarea name="notes" label="Notas" defaultValue={defaults.notes} autosize minRows={2} maxLength={2000} />
        <Button type="submit" loading={pending} fullWidth size="md">{defaults.id ? "Salvar" : "Criar evento"}</Button>
      </Stack>
    </ActionForm>
  );
}
