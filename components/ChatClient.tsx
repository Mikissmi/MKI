"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Box, Button, Group, Loader, Stack, Text, Textarea } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { IconTile, Pill } from "@/components/ui/Panel";
import { acceptAllBlocks } from "@/app/(app)/plan-actions";
import { fmtDuration, fmtMin } from "@/lib/time";

export type ChatBlock = { startMin: number; durationMin: number; kind: string; title: string; reason: string };
export type ChatMsg = { id: string; role: "user" | "assistant"; content: string; plan: ChatBlock[] | null; source: string | null };

const KIND_ICON: Record<string, string> = { leitura: "book2", artigo: "news", atividade: "star", habito: "check", pausa: "leaf", mini_vitoria: "sparkles", exercicio: "run" };
const SUGGESTIONS = ["Hoje estou cansada, reorganiza meu dia", "Tenho 40 minutos livres", "Quero um dia com menos tela"];

export function ChatClient({ initial }: { initial: ChatMsg[] }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  async function send(message: string) {
    const m = message.trim();
    if (!m || busy) return;
    setText("");
    setBusy(true);
    setMsgs((x) => [...x, { id: `u${Date.now()}`, role: "user", content: m, plan: null, source: null }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: m }) });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMsgs((x) => [...x, { id: `a${Date.now()}`, role: "assistant", content: data.reply, plan: data.blocks?.length ? data.blocks : null, source: data.source }]);
      router.refresh();
    } catch {
      setMsgs((x) => [...x, { id: `e${Date.now()}`, role: "assistant", content: "Não consegui responder agora. Tente de novo em instantes.", plan: null, source: "rules" }]);
    } finally { setBusy(false); }
  }

  return (
    <Stack gap="sm" style={{ minHeight: "60dvh" }}>
      {msgs.length === 0 && (
        <Stack gap="xs" mt="md">
          <Text c="dimmed" size="sm">Peça ajuda com a sua rotina. Por exemplo:</Text>
          {SUGGESTIONS.map((s) => <Button key={s} variant="light" radius="xl" justify="flex-start" onClick={() => send(s)}>{s}</Button>)}
        </Stack>
      )}
      {msgs.map((m) => (
        <Box key={m.id} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
          <Box p="sm" style={{ background: m.role === "user" ? "light-dark(#fde0e8, rgba(232,93,151,0.25))" : "light-dark(#fffdf8, var(--mantine-color-dark-6))", border: "1px solid light-dark(#f3d9de, var(--mantine-color-dark-4))", borderRadius: 20 }}>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{m.content}</Text>
            {m.plan && (
              <Stack gap={6} mt="sm">
                {m.plan.map((b, i) => (
                  <Group key={i} gap="xs" wrap="nowrap">
                    <IconTile icon={KIND_ICON[b.kind] ?? "star"} tone={i % 3 === 0 ? "pink" : i % 3 === 1 ? "sage" : "lavender"} size={34} round />
                    <div><Text size="sm" fw={700} lh={1.2}>{b.title}</Text><Text size="xs" c="dimmed">{fmtMin(b.startMin)} · {fmtDuration(b.durationMin)}</Text></div>
                  </Group>
                ))}
                <Group gap="xs" mt={4} grow>
                  <Button size="compact-md" disabled={accepted.has(m.id)} onClick={() => startTransition(async () => { await acceptAllBlocks(); setAccepted((s) => new Set(s).add(m.id)); router.refresh(); })}>
                    {accepted.has(m.id) ? "Plano aceito" : "Aceitar plano"}
                  </Button>
                  <Button size="compact-md" variant="light" color="sage" onClick={() => { setText("Ajusta: "); input.current?.focus(); }}>Ajustar</Button>
                </Group>
              </Stack>
            )}
          </Box>
          {m.role === "assistant" && m.source === "rules" && <Box mt={4}><Pill tone="lavender" icon="lock">modo regras</Pill></Box>}
        </Box>
      ))}
      {busy && <Group gap="xs"><Loader size="xs" color="lotus" /><Text size="xs" c="dimmed">pensando...</Text></Group>}
      <div ref={bottom} />
      <Group gap="xs" align="flex-end" wrap="nowrap" style={{ position: "sticky", bottom: "calc(var(--mki-nav-height) + 12px + env(safe-area-inset-bottom))", background: "light-dark(#fbf5ec, var(--mantine-color-dark-8))", paddingTop: 6 }}>
        <Textarea ref={input} value={text} onChange={(e) => setText(e.currentTarget.value)} placeholder="Digite uma mensagem..." autosize minRows={1} maxRows={4} maxLength={600} style={{ flex: 1 }} radius="xl"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
        <ActionIcon size={42} radius="xl" color="lotus" aria-label="Enviar" onClick={() => send(text)} disabled={busy || !text.trim()}><Icon name="send" size={20} /></ActionIcon>
      </Group>
    </Stack>
  );
}
