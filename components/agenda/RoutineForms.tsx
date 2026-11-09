"use client";

import { ActionForm } from "@/components/ActionForm";
import { useActionState, useState } from "react";
import { Accordion, Alert, Button, Checkbox, Group, NativeSelect, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import { deleteRoutineBlock, saveHours, saveRoutineBlock } from "@/app/(app)/agenda/actions";
import { CATEGORIES } from "@/lib/agenda/categories";
import { TRAVEL_MODES, type RoutineBlock } from "@/lib/agenda/occurrences";
import type { FormState } from "@/lib/agenda/schemas";
import { fmtMin } from "@/lib/time";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function HoursForm({ wake, sleep }: { wake: string; sleep: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveHours, {});
  return (
    <ActionForm action={action}>
      <Stack gap="sm">
        <Group grow align="flex-start">
          <TextInput name="wake" type="time" label="Acordar" defaultValue={wake} error={state.fieldErrors?.wake} required />
          <TextInput name="sleep" type="time" label="Dormir" defaultValue={sleep} error={state.fieldErrors?.sleep} required />
        </Group>
        {state.ok && <Text size="xs" c="sage.9" fw={700}>salvo</Text>}
        <Button type="submit" loading={pending} variant="light">Salvar horários</Button>
      </Stack>
    </ActionForm>
  );
}

const hoursText = (min: number | null) => (min === null ? "" : String(min / 60).replace(".", ","));
const fmtHours = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;

function BlockForm({ block }: { block?: RoutineBlock }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRoutineBlock, {});
  const [mode, setMode] = useState<string>(block?.mode ?? "fixed");
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={block?.id ?? ""} />
      <Stack gap="sm">
        {state.error && <Alert color="red" variant="light" role="alert">{state.error}</Alert>}
        <TextInput name="title" label="Nome" defaultValue={block?.title ?? ""} error={err("title")} maxLength={80} />
        <div>
          <Text size="sm" fw={500} mb={4}>Dias</Text>
          <Group gap="xs">
            {DAYS.map((d, i) => (
              <Checkbox key={d} name="weekdays" value={String(i)} label={d} defaultChecked={block ? block.weekdays.includes(i) : i >= 1 && i <= 5} />
            ))}
          </Group>
          {err("weekdays") && <Text size="xs" c="red">{err("weekdays")}</Text>}
        </div>
        <NativeSelect name="category" label="Categoria" defaultValue={block?.category ?? "trabalho"} data={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />

        <div>
          <Text size="sm" fw={500} mb={4}>Horário</Text>
          <SegmentedControl fullWidth name="mode" value={mode} onChange={setMode} aria-label="Modo do horário" data={[{ value: "fixed", label: "Fixo" }, { value: "flexible", label: "Flexível" }]} />
        </div>
        {/* os dois blocos ficam montados (só um aparece), então o que foi digitado não se perde ao alternar */}
        <div hidden={mode !== "fixed"}>
          <Group grow align="flex-start">
            <TextInput name="start" type="time" label="Início" defaultValue={block ? fmtMin(block.startMin) : "09:00"} error={err("start")} />
            <TextInput name="end" type="time" label="Fim" defaultValue={block ? fmtMin(block.endMin) : "18:00"} error={err("end")} />
          </Group>
        </div>
        <div hidden={mode !== "flexible"}>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">O início pode variar dentro de uma janela. O fim é o início mais a duração. Em cada dia você confirma o horário real; até lá vale o preferido.</Text>
            <Group grow align="flex-start">
              <TextInput name="earliest" type="time" label="Começa a partir de" defaultValue={block?.startEarliest != null ? fmtMin(block.startEarliest) : "08:00"} error={err("earliest")} />
              <TextInput name="latest" type="time" label="Começa até" defaultValue={block?.startLatest != null ? fmtMin(block.startLatest) : "10:00"} error={err("latest")} />
            </Group>
            <Group grow align="flex-start">
              <TextInput name="preferred" type="time" label="Horário preferido" defaultValue={block?.preferredStart != null ? fmtMin(block.preferredStart) : "09:00"} error={err("preferred")} />
              <TextInput name="duration_hours" inputMode="decimal" label="Duração (horas)" defaultValue={hoursText(block?.durationMin ?? 480)} error={err("duration_hours")} description="Ex.: 8 ou 7,5" />
            </Group>
          </Stack>
        </div>

        <Text size="sm" fw={700} mt="xs">Deslocamento</Text>
        <Text size="xs" c="dimmed" mt={-8}>O app cria os trajetos de ida e de volta nos dias do bloco. Eles aparecem na agenda e não contam como tempo livre.</Text>
        <Group grow align="flex-start">
          <TextInput name="travel_to" inputMode="numeric" label="Ida (minutos)" defaultValue={block && block.travelTo > 0 ? String(block.travelTo) : ""} placeholder="0" error={err("travel_to")} />
          <TextInput name="travel_from" inputMode="numeric" label="Volta (minutos)" defaultValue={block && block.travelFrom > 0 ? String(block.travelFrom) : ""} placeholder="0" error={err("travel_from")} />
        </Group>
        <NativeSelect name="travel_mode" label="Meio de transporte" defaultValue={block?.travelMode ?? ""} error={err("travel_mode")} data={[{ value: "", label: "Não informar" }, ...TRAVEL_MODES.map((m) => ({ value: m.value, label: m.label }))]} />
        <Checkbox name="travel_suggestions" label="Sugerir leitura ou podcast no trajeto" defaultChecked={block?.travelSuggestions ?? false} />

        {state.ok && <Text size="xs" c="sage.9" fw={700}>salvo</Text>}
        <Button type="submit" loading={pending}>{block ? "Salvar bloco" : "Adicionar bloco"}</Button>
      </Stack>
    </ActionForm>
  );
}

const travelText = (b: RoutineBlock) => {
  if (!b.travelTo && !b.travelFrom) return null;
  const m = TRAVEL_MODES.find((x) => x.value === b.travelMode)?.label;
  return `ida ${b.travelTo} min · volta ${b.travelFrom} min${m ? ` · ${m}` : ""}`;
};
const timeText = (b: RoutineBlock) =>
  b.mode === "flexible"
    ? `flexível: começa entre ${fmtMin(b.startEarliest ?? b.startMin)} e ${fmtMin(b.startLatest ?? b.startMin)} (prefere ${fmtMin(b.preferredStart ?? b.startMin)}) · ${fmtHours(b.durationMin ?? b.endMin - b.startMin)}`
    : `${fmtMin(b.startMin)}–${fmtMin(b.endMin)}`;

export function RoutineBlocks({ blocks }: { blocks: RoutineBlock[] }) {
  return (
    <Accordion variant="separated" radius="lg">
      {blocks.map((b) => (
        <Accordion.Item key={b.id} value={b.id}>
          <Accordion.Control>
            <Text fw={700}>{b.title}</Text>
            <Text size="xs" c="dimmed">{b.weekdays.map((d) => DAYS[d]).join(", ")} · {timeText(b)}</Text>
            {travelText(b) && <Text size="xs" c="dimmed">{travelText(b)}</Text>}
          </Accordion.Control>
          <Accordion.Panel>
            <BlockForm block={b} />
            <form action={deleteRoutineBlock}>
              <input type="hidden" name="id" value={b.id} />
              <Button type="submit" color="red" variant="subtle" fullWidth mt="xs">Excluir bloco</Button>
            </form>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
      <Accordion.Item value="new">
        <Accordion.Control><Text fw={700} c="lotus.6">+ Novo bloco</Text></Accordion.Control>
        <Accordion.Panel><BlockForm /></Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
