import { Card, SimpleGrid, Stack, Text } from "@mantine/core";
import {
  IconBulb, IconChartPie, IconChefHat, IconHeart, IconHeartPlus, IconMapPin, IconMusic, IconPalette, IconSettings, IconTargetArrow, IconWallet,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata = { title: "Mais" };

const ITEMS = [
  { label: "Hábitos", icon: IconTargetArrow },
  { label: "Hobbies", icon: IconBulb },
  { label: "Receitas", icon: IconChefHat },
  { label: "Música e podcasts", icon: IconMusic },
  { label: "Estúdio criativo", icon: IconPalette },
  { label: "Viagens", icon: IconMapPin },
  { label: "Desejos", icon: IconHeart },
  { label: "Saúde", icon: IconHeartPlus },
  { label: "Finanças", icon: IconWallet },
  { label: "Retrospectivas", icon: IconChartPie },
  { label: "Configurações", icon: IconSettings },
];

export default function MorePage() {
  return (
    <>
      <PageHeader title="Mais" />
      <SimpleGrid cols={2} spacing="sm">
        {ITEMS.map(({ label, icon: Icon }) => (
          <Card key={label} padding="md" style={{ opacity: 0.75 }}>
            <Stack gap={4}>
              <Icon size={26} color="var(--mantine-color-lotus-6)" />
              <Text fw={700} size="sm">{label}</Text>
              <Text size="xs" c="dimmed">em breve</Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <LogoutButton />
    </>
  );
}
