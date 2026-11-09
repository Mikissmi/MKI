"use client";

import { useActionState } from "react";
import { Button, Stack, Text, Textarea } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import { saveReflection } from "@/app/(app)/retrospectivas/actions";
import type { FormState } from "@/lib/agenda/schemas";

export function ReflectionForm({ period, start, initial }: { period: string; start: string; initial: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveReflection, {});
  return (
    <ActionForm action={action}>
      <Stack gap="xs">
        <input type="hidden" name="period" value={period} /><input type="hidden" name="start" value={start} />
        <Textarea name="reflection" defaultValue={initial ?? ""} autosize minRows={3} maxRows={10} maxLength={2000} placeholder="Como foi? O que você quer levar para o próximo período?" aria-label="Minha reflexão" />
        {state.error && <Text size="xs" c="red">{state.error}</Text>}
        <Button type="submit" loading={pending} size="compact-md" variant="light">{state.ok ? "Salvo" : "Salvar reflexão"}</Button>
      </Stack>
    </ActionForm>
  );
}
