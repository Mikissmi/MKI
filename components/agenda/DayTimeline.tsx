import Link from "next/link";
import { Badge, Box, Card, Group, Stack, Text } from "@mantine/core";
import { categoryColor, categoryLabel } from "@/lib/agenda/categories";
import type { Occurrence } from "@/lib/agenda/occurrences";
import type { Interval } from "@/lib/agenda/free-slots";
import { fmtDuration, fmtMin } from "@/lib/time";

type Item = { type: "occ"; occ: Occurrence; at: number } | { type: "free"; slot: Interval; at: number };

/** Linha do tempo de um dia: compromissos, rotina-modelo e horários livres. */
export function DayTimeline({ occurrences, freeSlots, nowMin, emptyText }: {
  occurrences: Occurrence[];
  freeSlots: Interval[];
  /** só para hoje: esmaece o que já passou */
  nowMin?: number;
  emptyText?: string;
}) {
  const items: Item[] = [
    ...occurrences.map((occ): Item => ({ type: "occ", occ, at: occ.startMin })),
    ...freeSlots.map((slot): Item => ({ type: "free", slot, at: slot.startMin })),
  ].sort((a, b) => a.at - b.at);

  if (items.length === 0) return <Text c="dimmed" size="sm">{emptyText ?? "Nada marcado para este dia."}</Text>;

  return (
    <Stack gap="xs">
      {items.map((it) => {
        if (it.type === "free") {
          const { startMin, endMin } = it.slot;
          return (
            <Box key={`f${startMin}`} p="sm" style={{ border: "2px dashed var(--mantine-color-sage-4)", borderRadius: "var(--mantine-radius-lg)", opacity: nowMin !== undefined && endMin <= nowMin ? 0.45 : 1 }}>
              <Group justify="space-between" wrap="nowrap">
                <Text size="sm" c="sage.8" fw={700}>Horário livre</Text>
                <Text size="sm" c="dimmed">{fmtMin(startMin)}–{fmtMin(endMin)} · {fmtDuration(endMin - startMin)}</Text>
              </Group>
            </Box>
          );
        }
        const o = it.occ;
        const color = categoryColor(o.category);
        const past = nowMin !== undefined && o.endMin <= nowMin;
        const card = (
          <Card padding="sm" style={{ borderLeft: `6px solid var(--mantine-color-${color}-5)`, opacity: past ? 0.5 : 1 }}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Text fw={700} truncate>{o.title}</Text>
                <Text size="xs" c="dimmed">
                  {fmtMin(o.startMin)}–{fmtMin(o.endMin === 1440 ? 1439 : o.endMin)}{o.location ? ` · ${o.location}` : ""}
                </Text>
              </div>
              <Badge variant="light" color={color} size="sm">{o.kind === "routine" ? "rotina" : categoryLabel(o.category)}</Badge>
            </Group>
          </Card>
        );
        return o.kind === "event" ? (
          <Link key={o.key} href={`/agenda/evento/${o.id}`} style={{ textDecoration: "none", color: "inherit" }}>{card}</Link>
        ) : (
          <div key={o.key}>{card}</div>
        );
      })}
    </Stack>
  );
}
