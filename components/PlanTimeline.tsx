import { Box, Button, Group, Stack, Text } from "@mantine/core";
import type { Occurrence } from "@/lib/agenda/occurrences";
import type { Interval } from "@/lib/agenda/free-slots";
import { fmtDuration, fmtMin } from "@/lib/time";
import { TONES, type Tone } from "@/lib/tones";
import { IconTile, Pill } from "@/components/ui/Panel";
import { OccurrenceCard } from "@/components/agenda/OccurrenceCard";
import { acceptBlock, dismissBlock, removeBlock, swapBlock } from "@/app/(app)/plan-actions";

export type BlockRow = { id: string; start_min: number; duration_min: number; kind: string; title: string; reason: string | null; status: "proposed" | "accepted"; screen_type: string | null };

const KIND_ICON: Record<string, string> = { leitura: "book2", artigo: "news", atividade: "star", habito: "check", pausa: "leaf", mini_vitoria: "sparkles", exercicio: "run", podcast: "headphones", ajuste: "clock" };

type Item = { at: number; occ?: Occurrence; block?: BlockRow; free?: Interval };

/** Linha do tempo do dia: compromissos, rotina, sugestões (aceitar / trocar / dispensar) e horários livres. */
export function PlanTimeline({ occurrences, blocks, freeSlots, nowMin, lightDay }: { occurrences: Occurrence[]; blocks: BlockRow[]; freeSlots: Interval[]; nowMin: number; lightDay: boolean }) {
  const items: Item[] = [
    ...occurrences.map((occ) => ({ at: occ.startMin, occ })),
    ...blocks.map((block) => ({ at: block.start_min, block })),
    ...freeSlots.map((free) => ({ at: free.startMin, free })),
  ].sort((a, b) => a.at - b.at);

  if (items.length === 0) return <Text c="dimmed" size="sm">Nada marcado para hoje.</Text>;

  return (
    <Stack gap={8}>
      {items.map((it) => {
        if (it.free) {
          return (
            <Box key={`f${it.at}`} px="sm" py={8} style={{ border: "2px dashed var(--mantine-color-sage-4)", borderRadius: 18, }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8}><IconTile icon="clock" tone="sage" size={26} round /><Text size="sm" c="sage.8" fw={700}>Horário livre</Text></Group>
                <Text size="xs" c="dimmed">{fmtMin(it.free.startMin)}–{fmtMin(it.free.endMin)} · {fmtDuration(it.free.endMin - it.free.startMin)}</Text>
              </Group>
            </Box>
          );
        }
        if (it.block) {
          const b = it.block;
          const tone: Tone = b.status === "accepted" ? "sage" : "lavender";
          const t = TONES[tone];
          return (
            <Box key={b.id} p="sm" style={{ background: t.bg, border: `1px ${b.status === "proposed" ? "dashed" : "solid"} ${t.accent}`, borderRadius: 20, color: t.fg }}>
              <Group wrap="nowrap" align="flex-start">
                <IconTile icon={b.status === "proposed" ? "robot" : KIND_ICON[b.kind] ?? "star"} tone={tone} size={42} round />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Group justify="space-between" wrap="nowrap" gap={6}>
                    <Text size="sm" fw={800} c="inherit">{fmtMin(b.start_min)} · {fmtDuration(b.duration_min)}</Text>
                    <Pill tone={tone}>{b.status === "proposed" ? "sugestão" : "aceita"}</Pill>
                  </Group>
                  <Text size="sm" fw={600} c="inherit">{b.title}</Text>
                  {b.reason && <Text size="xs" c="inherit" style={{ opacity: 0.9 }}>{b.reason}</Text>}
                </div>
              </Group>
              {b.status === "proposed" ? (
                <Group gap="xs" mt="xs" grow>
                  <form action={acceptBlock}><input type="hidden" name="id" value={b.id} /><Button type="submit" size="compact-sm" fullWidth color="lavender.7">Aceitar</Button></form>
                  <form action={swapBlock}><input type="hidden" name="id" value={b.id} /><Button type="submit" size="compact-sm" fullWidth variant="white" color="lavender.7">Trocar</Button></form>
                  <form action={dismissBlock}><input type="hidden" name="id" value={b.id} /><Button type="submit" size="compact-sm" fullWidth variant="subtle" color="dark">Dispensar</Button></form>
                </Group>
              ) : (
                <form action={removeBlock}><input type="hidden" name="id" value={b.id} /><Button type="submit" size="compact-xs" variant="subtle" color="dark" mt={4}>Remover</Button></form>
              )}
            </Box>
          );
        }
        const o = it.occ!;
        return <OccurrenceCard key={o.key} o={o} past={o.endMin <= nowMin} />;
      })}
      {lightDay && <Text size="xs" c="dimmed">Dia leve: sem cobranças, sem atrasos.</Text>}
    </Stack>
  );
}
