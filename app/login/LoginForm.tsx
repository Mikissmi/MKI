"use client";

import { useActionState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Alert, Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <ActionForm action={action}>
      <Stack>
        {state.error && <Alert color="red" variant="light">{state.error}</Alert>}
        <TextInput name="username" label="Usuário" autoComplete="username" autoCapitalize="none" required />
        <PasswordInput name="password" label="Senha" autoComplete="current-password" required />
        <Button type="submit" loading={pending} fullWidth size="md">Entrar</Button>
      </Stack>
    </ActionForm>
  );
}
