"use client";

import { useState, useTransition } from "react";
import { Alert, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { Cover } from "@/components/ui/Cover";
import { Pill } from "@/components/ui/Panel";
import { addFromSpotify, refreshSpotify, searchAction, type SearchOutcome } from "@/app/(app)/musica/spotify-actions";

const KIND_LABEL = { album: "Álbum", artist: "Artista", podcast: "Podcast" } as const;

/** Busca no Spotify (álbum, artista, podcast) e botão para adicionar a "Para ouvir". */
export function SpotifySearch({ disabled }: { disabled?: boolean }) {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [out, setOut] = useState<SearchOutcome | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = () => start(async () => { setMsg(null); setAdded(new Set()); setTerm(q); setOut(await searchAction(q)); });
  return (
    <Stack gap="xs">
      <form onSubmit={(e) => { e.preventDefault(); if (q.trim().length >= 2) run(); }}>
        <Group gap="xs" wrap="nowrap" align="flex-end">
          <TextInput style={{ flex: 1 }} label="Buscar no Spotify" placeholder="Álbum, artista ou podcast" value={q} onChange={(e) => setQ(e.currentTarget.value)} maxLength={80} disabled={disabled} />
          <Button type="submit" loading={pending} disabled={disabled || q.trim().length < 2} leftSection={<Icon name="search" size={16} />}>Buscar</Button>
        </Group>
      </form>
      {out?.error && <Alert color="orange" variant="light" role="alert">{out.error}</Alert>}
      {msg && <Alert color={msg.ok ? "green" : "red"} variant="light" role="status">{msg.text}</Alert>}
      {out && out.results.length === 0 && !out.error && <Text size="sm" c="dimmed">Nada encontrado para "{term}".</Text>}
      {out && out.results.map((r) => (
        <Group key={r.id} wrap="nowrap" gap="sm">
          <Cover url={r.cover} icon={r.kind === "podcast" ? "mic" : "music"} tone="sun" width={52} height={52} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={800} lineClamp={1}>{r.title}</Text>
            <Group gap={6}><Pill tone="lavender">{KIND_LABEL[r.kind]}</Pill>{r.creator && <Text size="xs" c="dimmed" lineClamp={1}>{r.creator}</Text>}</Group>
          </div>
          <Button size="compact-sm" variant="light" loading={busyId === r.id} disabled={added.has(r.id)} aria-label={`Adicionar ${r.title} a Para ouvir`}
            onClick={() => { setBusyId(r.id); start(async () => { const res = await addFromSpotify(term, r.id); setMsg({ ok: res.ok, text: res.message }); if (res.ok) setAdded((s) => new Set(s).add(r.id)); setBusyId(null); }); }}>
            {added.has(r.id) ? "Adicionado" : "Adicionar"}
          </Button>
        </Group>
      ))}
    </Stack>
  );
}

/** Botão "Atualizar" (playlists e histórico), com o resultado ao lado. */
export function SpotifyRefresh() {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <Stack gap={4} align="flex-start">
      <Button size="compact-sm" variant="light" loading={pending} leftSection={<Icon name="refresh" size={14} />} onClick={() => start(async () => setRes(await refreshSpotify()))}>Atualizar do Spotify</Button>
      {res && <Text size="xs" role="status" c={res.ok ? undefined : "red"}>{res.message}</Text>}
    </Stack>
  );
}
