"use client";

import { useActionState } from "react";
import { Alert, Button, FileInput, Stack, Text } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import { importAction } from "@/app/(app)/configuracoes/import-action";
import type { ImportResult } from "@/lib/export";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult | null, FormData>(importAction, null);
  return (
    <ActionForm action={action}>
      <Stack gap="xs">
        <Text size="sm" fw={700}>Restaurar backup (JSON)</Text>
        <FileInput name="file" accept="application/json,.json" placeholder="Escolher arquivo de backup" aria-label="Escolher arquivo de backup" clearable />
        <Text size="xs" c="dimmed">Soma ao que você já tem; registros repetidos são ignorados.</Text>
        {state && (state.ok
          ? <Alert color="green" variant="light">{state.inserted} registros importados{state.skipped ? `, ${state.skipped} já existiam ou foram ignorados` : ""}.</Alert>
          : <Alert color="red" variant="light">{state.error}</Alert>)}
        <Button type="submit" loading={pending} variant="white" color="lavender.7">Importar</Button>
      </Stack>
    </ActionForm>
  );
}
