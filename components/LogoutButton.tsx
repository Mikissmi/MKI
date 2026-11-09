"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Stack } from "@mantine/core";
import { IconLogout } from "@tabler/icons-react";
import { flush } from "@/lib/offline-queue";

/** Ao sair, envia o que ficou guardado, apaga as páginas guardadas no aparelho e encerra a sessão. */
async function cleanLocal() {
  try { await flush(); } catch { /* sem IndexedDB: segue */ }
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("mki-pages")).map((k) => caches.delete(k)));
    navigator.serviceWorker?.controller?.postMessage("clear-private-caches");
  } catch { /* sem Cache API: segue */ }
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<"one" | "all" | null>(null);

  async function logout(all: boolean) {
    setBusy(all ? "all" : "one");
    await cleanLocal();
    await fetch(`/api/auth/logout${all ? "?all=1" : ""}`, { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Stack mt="xl" gap="xs">
      <Button variant="light" color="gray" leftSection={<IconLogout size={18} />} loading={busy === "one"} onClick={() => logout(false)}>Sair</Button>
      <Button variant="subtle" color="dark" size="xs" loading={busy === "all"} onClick={() => logout(true)}>Sair de todos os aparelhos</Button>
    </Stack>
  );
}
