import Link from "next/link";
import type { ReactNode } from "react";
import { Box, Group, Text, Title } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { Logo } from "./Logo";

/** Cabeçalho dos protótipos: seta de voltar, logo e título; ação opcional à direita. */
export function PageHeader({ title, subtitle, back, action }: { title: string; subtitle?: string; back?: string; action?: ReactNode }) {
  return (
    <Group justify="space-between" align="center" mb="md" wrap="nowrap" gap="xs">
      <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
        {back && (
          <Link href={back} aria-label="Voltar" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: "50%", background: "light-dark(#fff, var(--mantine-color-dark-5))", color: "var(--mantine-color-lotus-8)", flexShrink: 0 }}>
            <Icon name="back" size={20} />
          </Link>
        )}
        <Box style={{ minWidth: 0 }}>
          <Group gap={8} wrap="nowrap"><Logo size={28} /><Title order={2} fz={24} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Title></Group>
          {subtitle && <Text c="dimmed" size="sm" mt={2}>{subtitle}</Text>}
        </Box>
      </Group>
      {action}
    </Group>
  );
}
