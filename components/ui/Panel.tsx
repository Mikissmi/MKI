import type { CSSProperties, ReactNode } from "react";
import { Box, Group, Text } from "@mantine/core";
import { TONES, type Tone } from "@/lib/tones";
import { Icon } from "@/lib/icons";

/** Cartão pastel arredondado dos protótipos. */
export function Panel({ tone = "plain", title, icon, action, children, p = "md", style, className }: {
  tone?: Tone; title?: ReactNode; icon?: string; action?: ReactNode; children?: ReactNode; p?: string; style?: CSSProperties; className?: string;
}) {
  const t = TONES[tone];
  return (
    <Box
      p={p}
      className={className}
      style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 24, boxShadow: "0 2px 10px rgba(120,60,80,0.06)", color: t.fg, ...style }}
    >
      {(title || action) && (
        <Group justify="space-between" mb="sm" wrap="nowrap">
          <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
            {icon && <IconTile icon={icon} tone={tone === "plain" ? "pink" : tone} size={30} />}
            <Text fw={800} size="sm" truncate>{title}</Text>
          </Group>
          {action}
        </Group>
      )}
      {children}
    </Box>
  );
}

export function IconTile({ icon, tone = "pink", size = 40, round = false }: { icon: string; tone?: Tone; size?: number; round?: boolean }) {
  const t = TONES[tone];
  return (
    <Box style={{ width: size, height: size, flexShrink: 0, display: "grid", placeItems: "center", background: t.tile, color: t.fg, borderRadius: round ? "50%" : size * 0.34 }}>
      <Icon name={icon} size={Math.round(size * 0.52)} />
    </Box>
  );
}

export function Pill({ tone = "pink", children, icon }: { tone?: Tone; children: ReactNode; icon?: string }) {
  const t = TONES[tone];
  return (
    <Box component="span" style={{ display: "inline-flex", alignItems: "center", gap: 4, background: t.tile, color: t.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {icon && <Icon name={icon} size={12} />}{children}
    </Box>
  );
}

export function StatTile({ tone, icon, label, value }: { tone: Tone; icon: string; label: string; value: ReactNode }) {
  return (
    <Panel tone={tone} p="sm" style={{ borderRadius: 20 }}>
      <IconTile icon={icon} tone={tone} size={34} round />
      <Text size="xs" mt={6} style={{ opacity: 0.8 }}>{label}</Text>
      <Text fw={800} size="md" lh={1.2}>{value}</Text>
    </Panel>
  );
}

export function ProgressBar({ value, tone = "pink", height = 10 }: { value: number; tone?: Tone; height?: number }) {
  const t = TONES[tone];
  return (
    <Box style={{ background: t.tile, borderRadius: 999, height, overflow: "hidden" }} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <Box style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: t.accent, borderRadius: 999 }} />
    </Box>
  );
}
