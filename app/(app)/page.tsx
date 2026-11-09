import { Card, Stack, Text } from "@mantine/core";
import { getSessionUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/PageHeader";

function greeting(hour: number) {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function TodayPage() {
  const user = await getSessionUser();
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(now));
  const date = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(now);
  return (
    <>
      <PageHeader title={`${greeting(hour)}, ${user?.username} 🌸`} subtitle={date} />
      <Stack>
        <Card>
          <Text fw={700}>Plano do dia</Text>
          <Text c="dimmed" size="sm">A linha do tempo e o check-in de humor e energia chegam na etapa 2.</Text>
        </Card>
      </Stack>
    </>
  );
}
