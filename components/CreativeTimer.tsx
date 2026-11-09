"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";
import { saveCreativeSession } from "@/app/(app)/estudio/actions";

const KEY = "mki:creative-timer";
type Saved = { startedAt: number; targetMin: number; projectId: string };

const fmt = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

/** Sessão criativa com timer (25 min). Guarda o início no navegador: dá para recarregar a página sem perder a contagem. */
export function CreativeTimer({ projects }: { projects: { id: string; title: string }[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [target, setTarget] = useState(25);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const warned = useRef(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw) as Saved; setSaved(s); setProjectId(s.projectId); setTarget(s.targetMin); } } catch { /* ignora */ }
  }, []);
  useEffect(() => { if (!saved) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, [saved]);

  const elapsedMs = saved ? now - saved.startedAt : 0;
  const remaining = saved ? saved.targetMin * 60_000 - elapsedMs : target * 60_000;
  const finished = saved !== null && remaining <= 0;
  useEffect(() => {
    if (finished && !warned.current) { warned.current = true; notifications.show({ title: "Sessão concluída", message: "Hora de salvar o tempo da sessão.", color: "lotus", autoClose: false }); }
  }, [finished]);

  const start = () => { const s = { startedAt: Date.now(), targetMin: target, projectId }; localStorage.setItem(KEY, JSON.stringify(s)); setSaved(s); setNow(Date.now()); warned.current = false; };
  const discard = () => { localStorage.removeItem(KEY); setSaved(null); warned.current = false; };
  const finish = useCallback(async () => {
    if (!saved) return;
    const minutes = Math.max(1, Math.min(saved.targetMin, Math.round((Date.now() - saved.startedAt) / 60_000)) || 1);
    setBusy(true);
    const r = await saveCreativeSession({ projectId: saved.projectId || null, minutes });
    setBusy(false);
    if (r.ok) { notifications.show({ message: `${minutes} min registrados`, color: "sage" }); discard(); router.refresh(); } else notifications.show({ message: r.error ?? "Não foi possível salvar", color: "red" });
  }, [saved, router]);

  return (
    <Stack gap="xs" align="center">
      <Text fw={800} fz={40} lh={1} style={{ fontVariantNumeric: "tabular-nums" }} role="timer" aria-live="off">{fmt(remaining)}</Text>
      {!saved ? (<>
        <NativeSelect aria-label="Projeto da sessão" w="100%" value={projectId} onChange={(e) => setProjectId(e.currentTarget.value)} data={[{ value: "", label: "Sem projeto" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]} />
        <Group gap={6}>{[15, 25, 45, 60].map((m) => <Button key={m} size="compact-xs" variant={target === m ? "filled" : "white"} color="lavender.6" onClick={() => setTarget(m)}>{m} min</Button>)}</Group>
        <Button fullWidth onClick={start} color="lotus">Iniciar sessão</Button>
      </>) : (
        <Group gap="xs" grow w="100%">
          <Button onClick={finish} loading={busy} color={finished ? "lotus" : "sage.7"}>{finished ? "Salvar sessão" : "Encerrar e salvar"}</Button>
          <Button onClick={discard} variant="white" color="gray">Descartar</Button>
        </Group>
      )}
    </Stack>
  );
}
