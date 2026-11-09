"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Text } from "@mantine/core";
import { Icon } from "@/lib/icons";

const ITEMS = [
  { href: "/", label: "Hoje", icon: "sun" },
  { href: "/agenda", label: "Agenda", icon: "calendar" },
  { href: "/leituras", label: "Leituras", icon: "book2" },
  { href: "/noticias", label: "Notícias", icon: "news" },
  { href: "/mais", label: "Mais", icon: "grid" },
];

/** Telas dentro de "Mais" mantêm a aba Mais ativa. */
const MAIS_PREFIXES = ["/mais", "/habitos", "/hobbies", "/receitas", "/musica", "/estudio", "/viagens", "/desejos", "/saude", "/financas", "/retrospectivas", "/configuracoes", "/assistente", "/ideias"];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/mais") return MAIS_PREFIXES.some((p) => pathname.startsWith(p));
    return pathname.startsWith(href);
  };
  return (
    <Box component="nav" aria-label="Navegação principal" style={{ position: "fixed", inset: "auto 0 0 0", zIndex: 100, padding: "0 12px calc(10px + env(safe-area-inset-bottom))", pointerEvents: "none" }}>
      <Box
        style={{
          pointerEvents: "auto", maxWidth: 560, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 6px",
          background: "light-dark(rgba(255,253,248,0.96), var(--mantine-color-dark-7))", borderRadius: 28,
          border: "1px solid light-dark(#f0e4d2, var(--mantine-color-dark-4))", boxShadow: "0 6px 24px rgba(120,60,80,0.14)",
        }}
      >
        {ITEMS.map(({ href, label, icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href} href={href} aria-current={active ? "page" : undefined}
              style={{
                flex: 1, textAlign: "center", padding: "6px 0", margin: "0 2px", borderRadius: 22, textDecoration: "none",
                background: active ? "light-dark(#fde0e8, rgba(232,93,151,0.25))" : "transparent",
                color: active ? "var(--mantine-color-lotus-7)" : "var(--mantine-color-dimmed)",
              }}
            >
              <Icon name={icon} size={22} stroke={active ? 2.3 : 1.7} />
              <Text size="10px" fw={active ? 800 : 600} c="inherit" lh={1.2}>{label}</Text>
            </Link>
          );
        })}
      </Box>
    </Box>
  );
}
