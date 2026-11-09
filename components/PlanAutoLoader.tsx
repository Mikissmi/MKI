"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader, Text, Group } from "@mantine/core";

/** Quando ainda não há plano do dia e a IA está disponível: pede o plano ao servidor e atualiza a tela. */
export function PlanAutoLoader() {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .catch(() => {})
      .finally(() => router.refresh());
  }, [router]);
  return (
    <Group gap="xs" py="sm"><Loader size="xs" color="lotus" /><Text size="sm" c="dimmed">Montando o seu plano do dia...</Text></Group>
  );
}
