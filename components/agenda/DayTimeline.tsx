import { Box, Group, Stack, Text } from "@mantine/core";
import type { Occurrence } from "@/lib/agenda/occurrences";
import type { Interval } from "@/lib/agenda/free-slots";
import { fmtDuration, fmtMin } from "@/lib/time";
import { IconTile } from "@/components/ui/Panel";
import { OccurrenceCard } from "./OccurrenceCard";


type Item = { type: "occ"; occ: Occurrence; at: number } | { type: "free"; slot: Interval; at: number };

/** Linha do tempo de um dia: compromissos, rotina-modelo e horários livres (cartões pastel). */
export function DayTimeline({ occurrences, freeSlots, nowMin, emptyText }: {
  occurrences: Occurrence[]; freeSlots: Interval[]; nowMin?: number; emptyText?: string;
}) {
  const items: Item[] = [
    ...occurrences.map((occ): Item => ({ type: "occ", occ, at: occ.startMin })),
    ...freeSlots.map((slot): Item => ({ type: "free", slot, at: slot.startMin })),
  ].sort((a, b) => a.at - b.at);

  if (items.length === 0) return <Text c="dimmed" size="sm">{emptyText ?? "Nada marcado para este dia."}</Text>;

  return (
    <Stack gap={8}>
      {items.map((it) => {
        if (it.type === "free") {
          const { startMin, endMin } = it.slot;
          return (
            <Box key={`f${startMin}`} px="sm" py={8} style={{ border: "2px dashed var(--mantine-color-sage-4)", borderRadius: 18,  }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8}><IconTile icon="clock" tone="sage" size={26} round /><Text size="sm" c="sage.8" fw={700}>Horário livre</Text></Group>
                <Text size="xs" c="dimmed">{fmtMin(startMin)}–{fmtMin(endMin)} · {fmtDuration(endMin - startMin)}</Text>
              </Group>
            </Box>
          );
        }
        const o = it.occ;
        return <OccurrenceCard key={o.key} o={o} past={nowMin !== undefined && o.endMin <= nowMin} />;
      })}
    </Stack>
  );
}
