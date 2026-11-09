import { Card, Text } from "@mantine/core";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Agenda" };

export default function Page() {
  return (
    <>
      <PageHeader title="Agenda" />
      <Card>
        <Text c="dimmed" size="sm">Eventos, rotina-modelo e horários livres chegam na etapa 2.</Text>
      </Card>
    </>
  );
}
