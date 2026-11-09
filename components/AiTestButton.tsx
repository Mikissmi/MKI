"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Stack } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { testAi } from "@/app/(app)/configuracoes/actions";

/** Faz uma chamada mínima ao Gemini e mostra o resultado exato (ou o motivo da falha). */
export function AiTestButton() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <Stack gap="xs">
      <Button variant="white" color="dark" size="compact-md" loading={pending} leftSection={<Icon name="sparkles" size={16} />} style={{ alignSelf: "flex-start" }} onClick={() => start(async () => setRes(await testAi()))}>Testar IA agora</Button>
      {res && <Alert color={res.ok ? "green" : "red"} variant="light" role="status">{res.message}</Alert>}
    </Stack>
  );
}
