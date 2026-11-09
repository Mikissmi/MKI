"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon, Button, Drawer, Group, NativeSelect, SimpleGrid, Stack, Text, Textarea, TextInput, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Icon } from "@/lib/icons";
import { IconTile } from "@/components/ui/Panel";
import { TONES, type Tone } from "@/lib/tones";
import { enqueue, send, type QueuedOp } from "@/lib/offline-queue";

type Mode = null | "expense" | "mood" | "habit" | "idea" | "link";
const TILES: { key: string; label: string; icon: string; tone: Tone; wide?: boolean }[] = [
  { key: "expense", label: "Gasto", icon: "wallet", tone: "pink" }, { key: "water", label: "Água", icon: "droplet", tone: "sage" },
  { key: "mood", label: "Humor", icon: "mood-4", tone: "sun" }, { key: "habit", label: "Hábito", icon: "check", tone: "lavender" },
  { key: "idea", label: "Ideia", icon: "bulb", tone: "pink" }, { key: "link", label: "Link para ler depois", icon: "link", tone: "sage" },
  { key: "event", label: "Evento", icon: "event", tone: "sun", wide: true },
];

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Botão flutuante "+": registro rápido. Sem internet, o registro fica guardado no aparelho e é enviado ao voltar a conexão. */
export function QuickAdd({ categories, habits }: { categories: { id: string; name: string }[]; habits: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(""); const [cat, setCat] = useState(""); const [note, setNote] = useState("");
  const [mood, setMood] = useState<number | null>(null); const [energy, setEnergy] = useState<number | null>(null);
  const [habit, setHabit] = useState(habits[0]?.id ?? ""); const [text, setText] = useState(""); const [url, setUrl] = useState("");

  const close = () => { setOpen(false); setMode(null); setError(null); setAmount(""); setNote(""); setText(""); setUrl(""); setMood(null); setEnergy(null); };

  async function run(op: { type: string; [k: string]: unknown }, okMessage: string) {
    const full: QueuedOp = { ...op, clientId: crypto.randomUUID(), date: todayKey() };
    setBusy(true); setError(null);
    let queued = false;
    if (typeof navigator !== "undefined" && !navigator.onLine) { await enqueue(full); queued = true; }
    else {
      const r = await send(full);
      if (r.result === "rejected") { setBusy(false); setError(r.error ?? "Não foi possível registrar."); return; }
      if (r.result === "network") { await enqueue(full); queued = true; }
    }
    window.dispatchEvent(new Event("mki-queue"));
    setBusy(false);
    notifications.show({ message: queued ? "Sem conexão: guardei aqui e envio quando voltar." : okMessage, color: queued ? "yellow" : "sage" });
    close();
    if (!queued) router.refresh();
  }

  const pick = (key: string) => {
    if (key === "water") return void run({ type: "water", delta: 1 }, "Mais um copo de água");
    if (key === "event") { close(); return router.push("/agenda/evento/novo"); }
    setMode(key as Mode); setError(null);
  };

  const Scale = ({ label, prefix, value, onChange }: { label: string; prefix: string; value: number | null; onChange: (n: number) => void }) => (
    <div role="radiogroup" aria-label={label}><Text size="sm" fw={700} mb={4}>{label}</Text>
      <Group gap={6} grow wrap="nowrap">{[1, 2, 3, 4, 5].map((n) => (
        <UnstyledButton key={n} role="radio" aria-checked={value === n} aria-label={`${label} ${n} de 5`} onClick={() => onChange(n)}
          style={{ display: "grid", placeItems: "center", height: 44, borderRadius: 14, background: value === n ? "var(--mantine-color-lotus-5)" : "rgba(0,0,0,0.04)", color: value === n ? "#fff" : "var(--mantine-color-dimmed)" }}><Icon name={`${prefix}-${n}`} size={24} /></UnstyledButton>))}</Group></div>
  );

  return (
    <>
      <ActionIcon aria-label="Registro rápido" size={56} radius="xl" variant="filled" color="lotus" onClick={() => setOpen(true)}
        style={{ position: "fixed", right: 16, bottom: "calc(var(--mki-nav-height) + 22px + env(safe-area-inset-bottom))", zIndex: 110, boxShadow: "var(--mantine-shadow-md)" }}><Icon name="plus" size={28} /></ActionIcon>
      <Drawer opened={open} onClose={close} position="bottom" size="auto" radius="xl" title={<Text fw={800}>{mode ? TILES.find((t) => t.key === mode)?.label : "O que você quer registrar agora?"}</Text>}>
        {!mode ? (
          <SimpleGrid cols={2} spacing="sm" pb="md">
            {TILES.map((t) => {
              const c = TONES[t.tone];
              return (
                <UnstyledButton key={t.key} onClick={() => pick(t.key)} disabled={busy} style={{ gridColumn: t.wide ? "span 2" : undefined, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 22, padding: 14, color: c.fg }}>
                  <Group gap="sm" wrap="nowrap"><IconTile icon={t.icon} tone={t.tone} size={44} round /><Text fw={800} size="sm" c="inherit" lh={1.2}>{t.label}</Text></Group>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
        ) : (
          <Stack gap="sm" pb="md">
            {mode === "expense" && (<>
              <TextInput label="Valor (R$)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} placeholder="12,50" data-autofocus />
              <NativeSelect label="Categoria" value={cat} onChange={(e) => setCat(e.currentTarget.value)} data={[{ value: "", label: "Sem categoria" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
              <TextInput label="Nota" value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={160} placeholder="Mercado, ônibus..." />
              <Button loading={busy} onClick={() => run({ type: "expense", amount, category_id: cat || null, note }, "Gasto registrado")}>Registrar gasto</Button>
            </>)}
            {mode === "mood" && (<>
              <Scale label="Humor" prefix="mood" value={mood} onChange={setMood} /><Scale label="Sua energia" prefix="battery" value={energy} onChange={setEnergy} />
              <Button loading={busy} disabled={mood === null || energy === null} onClick={() => run({ type: "mood", mood: mood!, energy: energy! }, "Check-in salvo")}>Salvar check-in</Button>
            </>)}
            {mode === "habit" && (habits.length === 0 ? <Text size="sm" c="dimmed">Nenhum hábito pendente hoje.</Text> : (<>
              <NativeSelect label="Qual hábito você fez?" value={habit} onChange={(e) => setHabit(e.currentTarget.value)} data={habits.map((h) => ({ value: h.id, label: h.name }))} />
              <Button loading={busy} onClick={() => run({ type: "habit", habit_id: habit }, "Hábito marcado")}>Marcar como feito</Button></>))}
            {mode === "idea" && (<>
              <Textarea label="Sua ideia" value={text} onChange={(e) => setText(e.currentTarget.value)} autosize minRows={3} maxLength={500} data-autofocus />
              <Button loading={busy} disabled={!text.trim()} onClick={() => run({ type: "idea", text }, "Ideia guardada")}>Guardar ideia</Button>
            </>)}
            {mode === "link" && (<>
              <TextInput label="Link" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.currentTarget.value)} placeholder="https://" data-autofocus />
              <Text size="xs" c="dimmed">O título é buscado automaticamente e o link vai para Leituras, em Artigos.</Text>
              <Button loading={busy} disabled={!url.trim()} onClick={() => run({ type: "link", url: url.trim() }, "Link salvo em Leituras")}>Salvar para ler depois</Button>
            </>)}
            {error && <Text size="sm" c="red" role="alert">{error}</Text>}
            <Button variant="subtle" color="gray" onClick={() => { setMode(null); setError(null); }}>Voltar</Button>
          </Stack>
        )}
      </Drawer>
    </>
  );
}
