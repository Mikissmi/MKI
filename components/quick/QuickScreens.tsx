"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Group, NativeSelect, SimpleGrid, Stack, Text, Textarea, TextInput, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Icon } from "@/lib/icons";
import { enqueue, send, type QueuedOp } from "@/lib/offline-queue";

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Envia um registro (ou guarda na fila se estiver sem internet), mostra um aviso e volta para Hoje ao fim. */
function useQuickRun(backTo = "/") {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(op: { type: string; [k: string]: unknown }, message: string, opts: { stay?: boolean } = {}): Promise<boolean> {
    const full: QueuedOp = { ...op, clientId: crypto.randomUUID(), date: todayKey() };
    setBusy(true); setError(null);
    let queued = false;
    if (!navigator.onLine) { await enqueue(full); queued = true; }
    else {
      const r = await send(full);
      if (r.result === "rejected") { setBusy(false); setError(r.error ?? "Não foi possível registrar."); return false; }
      if (r.result === "network") { await enqueue(full); queued = true; }
    }
    window.dispatchEvent(new Event("mki-queue"));
    setBusy(false);
    notifications.show({ message: queued ? "Sem conexão: guardei aqui e envio quando voltar." : message, color: queued ? "yellow" : "sage" });
    if (!opts.stay) router.replace(backTo);
    return true;
  }
  return { run, busy, error, back: () => router.replace(backTo) };
}

const Err = ({ error }: { error: string | null }) => (error ? <Alert color="red" variant="light" role="alert">{error}</Alert> : null);

export function ExpenseScreen({ categories }: { categories: { id: string; name: string }[] }) {
  const { run, busy, error } = useQuickRun();
  const [amount, setAmount] = useState(""); const [cat, setCat] = useState(""); const [note, setNote] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run({ type: "expense", amount, category_id: cat || null, note: note || undefined }, "Gasto registrado"); }}>
      <Stack gap="md">
        <TextInput label="Valor (R$)" inputMode="decimal" autoFocus size="xl" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.currentTarget.value)} required />
        <NativeSelect label="Categoria" value={cat} onChange={(e) => setCat(e.currentTarget.value)} data={[{ value: "", label: "Sem categoria" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
        <TextInput label="Observação (opcional)" value={note} onChange={(e) => setNote(e.currentTarget.value)} maxLength={160} />
        <Err error={error} />
        <Button type="submit" size="lg" loading={busy} disabled={!amount.trim()}>Registrar gasto</Button>
      </Stack>
    </form>
  );
}

export function WaterScreen({ glasses, goal }: { glasses: number; goal: number }) {
  const { run, busy, error } = useQuickRun();
  return (
    <Stack gap="md" align="center" ta="center">
      <Text size="sm" c="dimmed">Hoje: {glasses} de {goal} copos</Text>
      <Button size="xl" radius="xl" h={120} w={220} loading={busy} autoFocus leftSection={<Icon name="droplet" size={32} />} onClick={() => void run({ type: "water", delta: 1 }, "Mais um copo de água")}>+1 copo</Button>
      <Err error={error} />
    </Stack>
  );
}

function Scale({ label, prefix, value, onChange }: { label: string; prefix: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <Text size="sm" fw={700} mb={6}>{label}</Text>
      <Group gap={6} grow wrap="nowrap">
        {[1, 2, 3, 4, 5].map((n) => (
          <UnstyledButton key={n} role="radio" aria-checked={value === n} aria-label={`${label} ${n} de 5`} onClick={() => onChange(n)}
            style={{ display: "grid", placeItems: "center", height: 56, borderRadius: 16, background: value === n ? "var(--mantine-color-lotus-5)" : "rgba(0,0,0,0.05)", color: value === n ? "#fff" : "var(--mantine-color-dimmed)" }}><Icon name={`${prefix}-${n}`} size={30} /></UnstyledButton>
        ))}
      </Group>
    </div>
  );
}

/** Dois toques: humor e energia. Salva sozinho quando os dois estiverem escolhidos. */
export function MoodScreen() {
  const { run, busy, error } = useQuickRun();
  const [mood, setMood] = useState<number | null>(null); const [energy, setEnergy] = useState<number | null>(null);
  const pick = (m: number | null, e: number | null) => { if (m && e && !busy) void run({ type: "mood", mood: m, energy: e }, "Check-in salvo"); };
  return (
    <Stack gap="lg">
      <Scale label="Humor" prefix="mood" value={mood} onChange={(n) => { setMood(n); pick(n, energy); }} />
      <Scale label="Energia" prefix="battery" value={energy} onChange={(n) => { setEnergy(n); pick(mood, n); }} />
      <Text size="xs" c="dimmed">Salva ao escolher os dois.</Text>
      <Err error={error} />
    </Stack>
  );
}

export function IdeaScreen() {
  const { run, busy, error } = useQuickRun();
  const [text, setText] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run({ type: "idea", text }, "Ideia guardada"); }}>
      <Stack gap="md">
        <Textarea label="Sua ideia" autoFocus autosize minRows={4} maxLength={500} value={text} onChange={(e) => setText(e.currentTarget.value)} required />
        <Err error={error} />
        <Button type="submit" size="lg" loading={busy} disabled={!text.trim()}>Guardar ideia</Button>
      </Stack>
    </form>
  );
}

export function LinkScreen() {
  const { run, busy, error } = useQuickRun();
  const [url, setUrl] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); void run({ type: "link", url: url.trim() }, "Guardado em Ler depois"); }}>
      <Stack gap="md">
        <TextInput label="Link" type="url" inputMode="url" autoFocus placeholder="https://" value={url} onChange={(e) => setUrl(e.currentTarget.value)} required />
        <Err error={error} />
        <Button type="submit" size="lg" loading={busy} disabled={!url.trim()}>Guardar para ler depois</Button>
      </Stack>
    </form>
  );
}

export function SleepScreen({ slept, woke }: { slept: string; woke: string }) {
  const { run, busy, error } = useQuickRun();
  const [a, setA] = useState(slept); const [b, setB] = useState(woke); const [q, setQ] = useState<number | null>(null);
  return (
    <Stack gap="md">
      <SimpleGrid cols={2}>
        <TextInput label="Dormi às" type="time" value={a} onChange={(e) => setA(e.currentTarget.value)} />
        <TextInput label="Acordei às" type="time" value={b} onChange={(e) => setB(e.currentTarget.value)} />
      </SimpleGrid>
      <Scale label="Qualidade do sono" prefix="mood" value={q} onChange={setQ} />
      <Err error={error} />
      <Button size="lg" loading={busy} disabled={!a || !b} onClick={() => void run({ type: "sleep", slept_at: a, woke_at: b, quality: q }, "Sono registrado")}>Registrar sono</Button>
    </Stack>
  );
}

const KINDS = ["Caminhada", "Corrida", "Yoga", "Musculação", "Bicicleta", "Outro"];
export function WorkoutScreen() {
  const { run, busy, error } = useQuickRun();
  const [kind, setKind] = useState("Caminhada");
  return (
    <Stack gap="md">
      <div role="radiogroup" aria-label="Tipo de exercício">
        <Text size="sm" fw={700} mb={6}>Tipo</Text>
        <Group gap={6}>{KINDS.map((k) => <Button key={k} role="radio" aria-checked={kind === k} variant={kind === k ? "filled" : "light"} size="compact-md" onClick={() => setKind(k)}>{k}</Button>)}</Group>
      </div>
      <div>
        <Text size="sm" fw={700} mb={6}>Quanto tempo? (toque para salvar)</Text>
        <SimpleGrid cols={4}>{[15, 30, 45, 60].map((m) => <Button key={m} size="lg" variant="light" loading={busy} onClick={() => void run({ type: "workout", kind, minutes: m }, "Exercício registrado")}>{m} min</Button>)}</SimpleGrid>
      </div>
      <Err error={error} />
    </Stack>
  );
}

export function HabitsScreen({ habits }: { habits: { id: string; name: string }[] }) {
  const { run, busy, error, back } = useQuickRun();
  const [done, setDone] = useState<string[]>([]);
  const pending = habits.filter((h) => !done.includes(h.id));
  async function mark(id: string) {
    const ok = await run({ type: "habit", habit_id: id }, "Hábito feito", { stay: true });
    if (!ok) return;
    const next = [...done, id]; setDone(next);
    if (habits.every((h) => next.includes(h.id))) back();
  }
  if (habits.length === 0) return <Text>Nada pendente hoje. Bom trabalho.</Text>;
  return (
    <Stack gap="sm">
      {pending.map((h) => <Button key={h.id} size="lg" variant="light" justify="flex-start" loading={busy} leftSection={<Icon name="check" size={20} />} onClick={() => void mark(h.id)}>{h.name}</Button>)}
      {done.length > 0 && <Text size="sm" c="dimmed">Feitos agora: {habits.filter((h) => done.includes(h.id)).map((h) => h.name).join(", ")}.</Text>}
      <Err error={error} />
      <Button variant="subtle" onClick={back}>Voltar para Hoje</Button>
    </Stack>
  );
}
