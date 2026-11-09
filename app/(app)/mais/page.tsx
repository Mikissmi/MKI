import Link from "next/link";
import { Box, SimpleGrid, Text, Title } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { IconTile } from "@/components/ui/Panel";
import { TONES, type Tone } from "@/lib/tones";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Mais" };

const ITEMS: { label: string; href: string; icon: string; tone: Tone; wide?: boolean }[] = [
  { label: "Hábitos", href: "/habitos", icon: "check", tone: "pink" },
  { label: "Hobbies", href: "/hobbies", icon: "brush", tone: "sage" },
  { label: "Receitas", href: "/receitas", icon: "chef", tone: "sun" },
  { label: "Música e podcasts", href: "/musica", icon: "headphones", tone: "lavender" },
  { label: "Estúdio criativo", href: "/estudio", icon: "star", tone: "pink" },
  { label: "Viagens", href: "/viagens", icon: "luggage", tone: "sage" },
  { label: "Desejos", href: "/desejos", icon: "heart", tone: "sun" },
  { label: "Saúde", href: "/saude", icon: "leaf", tone: "sage" },
  { label: "Finanças", href: "/financas", icon: "wallet", tone: "lavender" },
  { label: "Retrospectivas", href: "/retrospectivas", icon: "calendar", tone: "pink", wide: true },
  { label: "Configurações", href: "/configuracoes", icon: "settings", tone: "lavender" },
];

export default function MorePage() {
  return (
    <>
      <Box mb="lg"><Logo size={40} /><Title order={1} mt={4}>Mais</Title><Text c="dimmed" size="sm">Seu espaço para explorar</Text></Box>
      <SimpleGrid cols={3} spacing="sm">
        {ITEMS.map(({ label, href, icon, tone, wide }) => {
          const t = TONES[tone];
          return (
            <Link key={href} href={href} style={{ gridColumn: wide ? "span 2" : undefined, textDecoration: "none" }}>
              <Box style={{
                background: t.bg, border: `1px solid ${t.border}`, borderRadius: 22, minHeight: 104, padding: 12, color: t.fg,
                display: "flex", flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: "center", gap: 8, textAlign: "center",
              }}>
                <IconTile icon={icon} tone={tone} size={wide ? 52 : 48} round />
                <Text size="sm" fw={700} c="inherit" lh={1.2}>{label}</Text>
              </Box>
            </Link>
          );
        })}
      </SimpleGrid>
      <Text size="xs" c="dimmed" ta="center" mt="lg"><Link href="/assistente" style={{ color: "inherit" }}>Conversar com o assistente</Link> · <Link href="/ideias" style={{ color: "inherit" }}>Caixa de ideias</Link></Text>
    </>
  );
}
