"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<"one" | "all" | null>(null);

  async function logout(all: boolean) {
    setBusy(all ? "all" : "one");
    await fetch(`/api/auth/logout${all ? "?all=1" : ""}`, { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Stack mt="xl" gap="xs">
      <Button variant="light" color="gray" leftSection={<IconLogout size={18} />} loading={busy === "one"} onClick={() => logout(false)}>
        Sair
      </Button>
      <Button variant="subtle" color="gray" size="xs" loading={busy === "all"} onClick={() => logout(true)}>
        Sair de todos os aparelhos
      </Button>
    </Stack>
  );
}
