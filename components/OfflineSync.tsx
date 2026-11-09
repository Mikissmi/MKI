"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { notifications } from "@mantine/notifications";
import { Icon } from "@/lib/icons";
import { count, flush } from "@/lib/offline-queue";

/** Avisa quando está sem conexão e envia os registros guardados assim que ela volta. */
export function OfflineSync() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  const refreshCount = useCallback(() => { count().then(setPending).catch(() => setPending(0)); }, []);
  const sync = useCallback(async () => {
    try {
      const r = await flush();
      setPending(r.left);
      if (r.sent > 0) { notifications.show({ message: `${r.sent} ${r.sent === 1 ? "registro enviado" : "registros enviados"}`, color: "sage" }); router.refresh(); }
      if (r.dropped > 0) notifications.show({ message: `${r.dropped} registro(s) guardado(s) foram recusados pelo servidor.`, color: "red" });
    } catch { /* IndexedDB indisponível */ }
  }, [router]);

  useEffect(() => {
    setOnline(navigator.onLine); refreshCount();
    if (navigator.onLine) sync();
    const on = () => { setOnline(true); sync(); }, off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off); window.addEventListener("mki-queue", refreshCount);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); window.removeEventListener("mki-queue", refreshCount); };
  }, [sync, refreshCount]);

  if (online && pending === 0) return null;
  return (
    <div role="status" style={{ position: "sticky", top: 0, zIndex: 120, background: online ? "#f2c534" : "#6f4ca0", color: online ? "#3c2d00" : "#fff", fontSize: 13, fontWeight: 700, padding: "8px 14px", display: "flex", gap: 8, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Icon name={online ? "refresh" : "lock"} size={16} />
      {online ? `Enviando ${pending} ${pending === 1 ? "registro guardado" : "registros guardados"}...` : `Sem conexão: você vê os dados salvos neste aparelho.${pending ? ` ${pending} registro(s) serão enviados ao voltar.` : ""}`}
    </div>
  );
}
