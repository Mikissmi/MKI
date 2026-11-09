import { Group, Text, Title } from "@mantine/core";
import { Logo } from "./Logo";

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Group justify="space-between" align="center" mb="lg">
      <div>
        <Title order={2}>{title}</Title>
        {subtitle && <Text c="dimmed" size="sm">{subtitle}</Text>}
      </div>
      <Logo size={36} />
    </Group>
  );
}
