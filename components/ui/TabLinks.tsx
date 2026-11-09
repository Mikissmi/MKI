import Link from "next/link";
import { Box } from "@mantine/core";
import { Icon } from "@/lib/icons";

/** Abas em pílulas (navegação por link): a ativa em rosa, as outras claras como nos protótipos. */
export function TabLinks({ items, active, small = false }: { items: { key: string; label: string; href: string; icon?: string }[]; active: string; small?: boolean }) {
  return (
    <Box style={{ display: "flex", gap: 6 }}>
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key} href={it.href} aria-current={on ? "page" : undefined}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textAlign: "center", textDecoration: "none", borderRadius: 999, minHeight: small ? 34 : 40, padding: "4px 8px",
              fontWeight: 700, fontSize: small ? 12 : 13, lineHeight: 1.15,
              background: on ? "var(--mantine-color-lotus-5)" : "light-dark(#fffdf8, var(--mantine-color-dark-6))",
              color: on ? "#fff" : "light-dark(#8a5a63, var(--mantine-color-gray-4))",
              border: `1px solid ${on ? "var(--mantine-color-lotus-5)" : "light-dark(#f3dfd5, var(--mantine-color-dark-4))"}`,
              boxShadow: on ? "0 2px 8px rgba(232,93,151,0.3)" : undefined,
            }}
          >
            {it.icon && <Icon name={it.icon} size={14} />}{it.label}
          </Link>
        );
      })}
    </Box>
  );
}
