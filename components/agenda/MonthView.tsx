import Link from "next/link";
import { SimpleGrid, Text } from "@mantine/core";
import { categoryColor } from "@/lib/agenda/categories";
import type { Occurrence } from "@/lib/agenda/occurrences";
import { addDays, dayOfMonth, formatDateLong, startOfMonth, startOfWeek } from "@/lib/time";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

export function MonthView({ month, occurrences, today }: { month: string; occurrences: Occurrence[]; today: string }) {
  const first = startOfMonth(month);
  const gridStart = startOfWeek(first);
  const nextMonth = startOfMonth(addDays(first, 32));
  const weeks = Math.ceil((new Date(nextMonth).getTime() - new Date(gridStart).getTime()) / (7 * 86_400_000));
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const byDay = new Map<string, Occurrence[]>();
  for (const o of occurrences) if (o.kind === "event") byDay.set(o.date, [...(byDay.get(o.date) ?? []), o]);

  return (
    <>
      <SimpleGrid cols={7} spacing={4} mb={4}>
        {WEEKDAYS.map((w, i) => <Text key={i} ta="center" size="xs" c="dimmed" fw={700}>{w}</Text>)}
      </SimpleGrid>
      <SimpleGrid cols={7} spacing={4}>
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === first.slice(0, 7);
          const evs = byDay.get(d) ?? [];
          const isToday = d === today;
          return (
            <Link
              key={d}
              href={`/agenda?v=dia&d=${d}`}
              aria-label={`${dayOfMonth(d)}, ${formatDateLong(d)}${evs.length ? `, ${evs.length} evento(s)` : ""}`}
              style={{
                textDecoration: "none", color: "inherit", minHeight: 52, padding: 4, textAlign: "center",
                borderRadius: "var(--mantine-radius-md)", opacity: inMonth ? 1 : 0.35,
                background: isToday ? "var(--mantine-color-lotus-1)" : "light-dark(#fffdf8, var(--mantine-color-dark-6))",
                border: isToday ? "2px solid var(--mantine-color-lotus-5)" : "1px solid light-dark(var(--mantine-color-cream-3), var(--mantine-color-dark-4))",
              }}
            >
              <Text size="sm" fw={isToday ? 800 : 500}>{dayOfMonth(d)}</Text>
              <div style={{ display: "flex", justifyContent: "center", gap: 2, marginTop: 2, flexWrap: "wrap" }}>
                {evs.slice(0, 3).map((o) => (
                  <span key={o.key} style={{ width: 6, height: 6, borderRadius: 3, background: `var(--mantine-color-${categoryColor(o.category)}-5)` }} />
                ))}
              </div>
            </Link>
          );
        })}
      </SimpleGrid>
    </>
  );
}
