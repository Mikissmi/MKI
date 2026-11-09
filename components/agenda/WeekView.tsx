import Link from "next/link";
import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { categoryColor } from "@/lib/agenda/categories";
import type { Occurrence } from "@/lib/agenda/occurrences";
import { addDays, cap, fmtMin, formatDateShort } from "@/lib/time";

export function WeekView({ start, occurrences, today }: { start: string; occurrences: Occurrence[]; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <Stack gap="xs">
      {days.map((d) => {
        const list = occurrences.filter((o) => o.date === d);
        return (
          <Card key={d} padding="sm" style={d === today ? { borderColor: "var(--mantine-color-lotus-4)", borderWidth: 2 } : undefined}>
            <Group justify="space-between" mb={list.length ? 6 : 0}>
              <Link href={`/agenda?v=dia&d=${d}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Text fw={800} c={d === today ? "lotus.6" : undefined}>{cap(formatDateShort(d))}</Text>
              </Link>
              {list.length === 0 && <Text size="xs" c="dimmed">livre</Text>}
            </Group>
            <Stack gap={4}>
              {list.map((o) => (
                <Group key={o.key} gap="xs" wrap="nowrap">
                  <Badge variant="dot" color={categoryColor(o.category)} size="sm" style={{ flexShrink: 0 }}>{fmtMin(o.startMin)}</Badge>
                  {o.kind === "event" ? (
                    <Link href={`/agenda/evento/${o.id}`} style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>
                      <Text size="sm" truncate>{o.title}</Text>
                    </Link>
                  ) : (
                    <Text size="sm" c="dimmed" truncate>{o.title} (rotina)</Text>
                  )}
                </Group>
              ))}
            </Stack>
          </Card>
        );
      })}
    </Stack>
  );
}
