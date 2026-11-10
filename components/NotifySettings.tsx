"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Alert, Box, Button, Group, NativeSelect, Stack, Switch, Text, TextInput } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/lib/icons";
import type { NotifySettings as Notify } from "@/lib/settings";
import { disableAllNotify, saveNotify, sendTestPush } from "@/app/(app)/configuracoes/notificacoes/actions";
import type { FormState } from "@/lib/agenda/schemas";

const b64 = (s: string) => { const pad = "=".repeat((4 - (s.length % 4)) % 4); const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };

/** Liga/desliga as notificações neste aparelho (pede a permissão e registra a inscrição). */
export function PushDevice({ publicKey, configured }: { publicKey: string; configured: boolean }) {
  const [state, setState] = useState<"checking" | "unsupported" | "denied" | "off" | "on">("checking");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })();
  }, []);

  const turnOn = () => start(async () => {
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return setMsg({ ok: false, text: "Sem a permissão do aparelho não dá para enviar avisos." }); }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }));
      const res = await fetch("/api/push/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error("falha ao registrar");
      setState("on"); setMsg({ ok: true, text: "Notificações ligadas neste aparelho." });
    } catch { setMsg({ ok: false, text: "Não consegui ligar as notificações neste aparelho." }); }
  });
  const turnOff = () => start(async () => {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) { await fetch("/api/push/subscribe", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
    setState("off"); setMsg({ ok: true, text: "Notificações desligadas neste aparelho." });
  });

  return (
    <Stack gap="xs">
      {!configured && <Alert color="orange" variant="light">As chaves das notificações ainda não foram configuradas no servidor (veja o README).</Alert>}
      {state === "unsupported" && <Text size="sm">Este navegador não aceita notificações. No iPhone, só funciona com o app instalado na tela inicial (iOS 16.4 ou mais novo).</Text>}
      {state === "denied" && <Text size="sm">As notificações estão bloqueadas para o MKI neste aparelho. Libere nas configurações do navegador ou do app instalado.</Text>}
      {(state === "off") && <Button onClick={turnOn} loading={pending} disabled={!configured} leftSection={<Icon name="bell" size={16} />} style={{ alignSelf: "flex-start" }}>Ligar neste aparelho</Button>}
      {state === "on" && <Group gap="xs"><Text size="sm" fw={700}>Ligadas neste aparelho.</Text><Button onClick={turnOff} loading={pending} variant="white" color="dark" size="compact-md">Desligar neste aparelho</Button></Group>}
      {msg && <Text size="sm" role="status" c={msg.ok ? undefined : "red"}>{msg.text}</Text>}
    </Stack>
  );
}

export function NotifyForm({ initial }: { initial: Notify }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNotify, {});
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, startTest] = useTransition();
  const [offing, startOff] = useTransition();
  const fe = state.fieldErrors ?? {};
  return (
    <Stack gap="md">
      <ActionForm action={action}>
        <Stack gap="sm">
          <Switch name="enabled" label="Notificações" description="Chave geral: desligada, nada é enviado" defaultChecked={initial.enabled} color="lotus" />
          <Box p="sm" style={{ background: "rgba(0,0,0,0.03)", borderRadius: 16 }}>
            <Text size="sm" fw={800} mb={6}>Quais avisos</Text>
            <Stack gap={10}>
              <Switch name="plan" label="Seu plano está pronto" description="De manhã" defaultChecked={initial.plan} color="lotus" />
              <TextInput name="planTime" label="Horário do aviso do plano" type="time" defaultValue={initial.planTime} error={fe.planTime} />
              <Switch name="closing" label="Fechamento da noite" defaultChecked={initial.closing} color="lotus" />
              <TextInput name="closingTime" label="Horário do fechamento" type="time" defaultValue={initial.closingTime} error={fe.closingTime} />
              <Switch name="events" label="Lembrete de evento" defaultChecked={initial.events} color="lotus" />
              <TextInput name="lead" label="Avisar quantos minutos antes" inputMode="decimal" defaultValue={String(initial.eventLeadMin)} error={fe.lead} />
              <Switch name="retro" label="Retrospectiva pronta" defaultChecked={initial.retro} color="lotus" />
            </Stack>
          </Box>
          <Box p="sm" style={{ background: "rgba(0,0,0,0.03)", borderRadius: 16 }}>
            <Text size="sm" fw={800} mb={6}>Horário silencioso</Text>
            <Group grow><TextInput name="quietStart" label="Das" type="time" defaultValue={initial.quietStart} error={fe.quietStart} /><TextInput name="quietEnd" label="Até" type="time" defaultValue={initial.quietEnd} error={fe.quietEnd} /></Group>
            <Text size="xs" c="dimmed" mt={6}>Nesse período nenhum aviso é enviado. No máximo 3 avisos por dia, fora os lembretes de evento.</Text>
          </Box>
          {state.error && <Alert color="red" variant="light" role="alert">{state.error}</Alert>}
          {state.ok && <Alert color="green" variant="light" role="status">Salvo.</Alert>}
          <Button type="submit" loading={pending}>Salvar</Button>
        </Stack>
      </ActionForm>
      <Group gap="xs">
        <Button variant="light" loading={testing} leftSection={<Icon name="send" size={14} />} onClick={() => startTest(async () => setTest(await sendTestPush()))}>Enviar notificação de teste</Button>
        <Button variant="white" color="red.8" loading={offing} onClick={() => startOff(async () => { await disableAllNotify(); setTest({ ok: true, message: "Tudo desligado e inscrições apagadas." }); })}>Desligar tudo</Button>
      </Group>
      {test && <Alert color={test.ok ? "green" : "red"} variant="light" role="status">{test.message}</Alert>}
    </Stack>
  );
}
