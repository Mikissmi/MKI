"use client";

import { ActionForm } from "@/components/ActionForm";
import { useActionState } from "react";
import { Accordion, Alert, Button, Checkbox, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { deleteRoutineBlock, saveHours, saveRoutineBlock } from "@/app/(app)/agenda/actions";
import { CATEGORIES } from "@/lib/agenda/categories";
import type { RoutineBlock } from "@/lib/agenda/occurrences";
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
        {state.ok && <Text size="xs" c="sage.7" fw={700}>salvo</Text>}
        <Button type="submit" loading={pending} variant="light">Salvar horários</Button>
      </Stack>
    </ActionForm>
  );
}

function BlockForm({ block }: { block?: RoutineBlock }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRoutineBlock, {});
  return (
    <ActionForm action={action}>
      <input type="hidden" name="id" value={block?.id ?? ""} />
      <Stack gap="sm">
        {state.error && !state.fieldErrors?.title && !state.fieldErrors?.start && !state.fieldErrors?.end && !state.fieldErrors?.weekdays && <Alert color="red" variant="light">{state.error}</Alert>}
        <TextInput name="title" label="Nome" defaultValue={block?.title ?? ""} error={state.fieldErrors?.title} required maxLength={80} />
        <div>
          <Text size="sm" fw={500} mb={4}>Dias</Text>
          <Group gap="xs">
            {DAYS.map((d, i) => (
              <Checkbox key={d} name="weekdays" value={String(i)} label={d} defaultChecked={block ? block.weekdays.includes(i) : i >= 1 && i <= 5} />
            ))}
          </Group>
          {state.fieldErrors?.weekdays && <Text size="xs" c="red">{state.fieldErrors.weekdays}</Text>}
        </div>
        <Group grow align="flex-start">
          <TextInput name="start" type="time" label="Início" defaultValue={block ? fmtMin(block.startMin) : "09:00"} error={state.fieldErrors?.start} required />
          <TextInput name="end" type="time" label="Fim" defaultValue={block ? fmtMin(block.endMin) : "18:00"} error={state.fieldErrors?.end} required />
        </Group>
        <NativeSelect name="category" label="Categoria" defaultValue={block?.category ?? "trabalho"} data={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
        {state.ok && <Text size="xs" c="sage.7" fw={700}>salvo</Text>}
        <Button type="submit" loading={pending}>{block ? "Salvar bloco" : "Adicionar bloco"}</Button>
      </Stack>
    </ActionForm>
  );
}

export function RoutineBlocks({ blocks }: { blocks: RoutineBlock[] }) {
  return (
    <Accordion variant="separated" radius="lg">
      {blocks.map((b) => (
        <Accordion.Item key={b.id} value={b.id}>
          <Accordion.Control>
            <Text fw={700}>{b.title}</Text>
            <Text size="xs" c="dimmed">{b.weekdays.map((d) => DAYS[d]).join(", ")} · {fmtMin(b.startMin)}–{fmtMin(b.endMin)}</Text>
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
