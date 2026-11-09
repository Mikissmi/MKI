import Link from "next/link";
import { Box, Group, Stack, Text } from "@mantine/core";
import { categoryColor, categoryLabel } from "@/lib/agenda/categories";
import type { Occurrence } from "@/lib/agenda/occurrences";
import type { Interval } from "@/lib/agenda/free-slots";
import { fmtDuration, fmtMin } from "@/lib/time";
import { TONES, categoryTone } from "@/lib/tones";
import { IconTile, Pill } from "@/components/ui/Panel";

const CATEGORY_ICON: Record<string, string> = { trabalho: "briefcase", estudo: "book", pessoal: "heart", saude: "leaf", lazer: "star", outro: "calendar" };

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
            <Box key={`f${startMin}`} px="sm" py={8} style={{ border: "2px dashed var(--mantine-color-sage-4)", borderRadius: 18, opacity: nowMin !== undefined && endMin <= nowMin ? 0.45 : 1 }}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={8}><IconTile icon="clock" tone="sage" size={26} round /><Text size="sm" c="sage.8" fw={700}>Horário livre</Text></Group>
                <Text size="xs" c="dimmed">{fmtMin(startMin)}–{fmtMin(endMin)} · {fmtDuration(endMin - startMin)}</Text>
              </Group>
            </Box>
          );
        }
        const o = it.occ;
        const tone = categoryTone(o.category);
        const t = TONES[tone];
        const past = nowMin !== undefined && o.endMin <= nowMin;
        const card = (
          <Group wrap="nowrap" p="xs" pr="sm" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, color: t.fg, opacity: past ? 0.5 : 1 }}>
            <IconTile icon={CATEGORY_ICON[o.category] ?? "calendar"} tone={tone} size={42} round />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Text fw={800} size="sm" c="inherit" lh={1.25}>{fmtMin(o.startMin)}</Text>
              <Text fw={600} size="sm" c="inherit" truncate>{o.title}</Text>
              {o.location && <Text size="xs" c="inherit" style={{ opacity: 0.75 }} truncate>{o.location}</Text>}
            </div>
            <Pill tone={tone}>{o.kind === "routine" ? "rotina" : categoryLabel(o.category)}</Pill>
          </Group>
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
void categoryColor;
