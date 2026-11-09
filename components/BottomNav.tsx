"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { IconBook2, IconCalendar, IconDots, IconNews, IconSun } from "@tabler/icons-react";

const ITEMS = [
  { href: "/", label: "Hoje", icon: IconSun },
  { href: "/agenda", label: "Agenda", icon: IconCalendar },
  { href: "/leituras", label: "Leituras", icon: IconBook2 },
  { href: "/noticias", label: "Notícias", icon: IconNews },
  { href: "/mais", label: "Mais", icon: IconDots },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <Box
      component="nav"
      aria-label="Navegação principal"
      className="safe-bottom"
      style={{
        position: "fixed",
        inset: "auto 0 0 0",
        zIndex: 100,
        background: "light-dark(#fffdf8, var(--mantine-color-dark-7))",
        borderTop: "1px solid light-dark(var(--mantine-color-cream-3), var(--mantine-color-dark-4))",
      }}
    >
      <Group justify="space-around" gap={0} h="var(--mki-nav-height)" maw={640} mx="auto">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <UnstyledButton
              key={href}
              component={Link}
              href={href}
              aria-current={active ? "page" : undefined}
              style={{ flex: 1, textAlign: "center", padding: "8px 0" }}
            >
              <Icon size={24} stroke={active ? 2.4 : 1.7} color={active ? "var(--mantine-color-lotus-6)" : "var(--mantine-color-dimmed)"} />
              <Text size="xs" fw={active ? 800 : 500} c={active ? "lotus.6" : "dimmed"}>
                {label}
              </Text>
            </UnstyledButton>
          );
        })}
      </Group>
    </Box>
  );
}
