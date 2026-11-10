"use client";

import { useActionState } from "react";
import { Alert, Button, Stack, Text, TextInput } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import { LinkButton } from "@/components/LinkButton";
import { saveClosing } from "@/app/(app)/fechamento/actions";
import type { FormState } from "@/lib/agenda/schemas";

export function ClosingForm({ initial }: { initial: { line: string | null; priorities: string[]; focus: string | null } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveClosing, {});
  return (
    <ActionForm action={action}>
      <Stack gap="sm">
        <TextInput name="line" label="Uma linha sobre o seu dia (opcional)" defaultValue={initial.line ?? ""} maxLength={200} />
        <div>
          <Text size="sm" fw={600} mb={4}>De 1 a 3 coisas para amanhã</Text>
          <Stack gap={6}>
            {[0, 1, 2].map((i) => <TextInput key={i} name={`p${i + 1}`} aria-label={`Prioridade ${i + 1}`} placeholder={`Prioridade ${i + 1}`} defaultValue={initial.priorities[i] ?? ""} maxLength={120} />)}
          </Stack>
        </div>
        <TextInput name="focus" label="Foco de amanhã (opcional)" description="Uma frase sua. Se ficar em branco, o app sorteia um trecho que você salvou." defaultValue={initial.focus ?? ""} maxLength={140} />
        {state.error && <Alert color="red" variant="light" role="alert">{state.error}</Alert>}
        {state.ok && <Alert color="green" variant="light" role="status">Dia fechado. Boa noite!</Alert>}
        <Button type="submit" loading={pending} size="md">Fechar o dia</Button>
        {state.ok && <LinkButton href="/" variant="subtle">Voltar para Hoje</LinkButton>}
      </Stack>
    </ActionForm>
  );
}
