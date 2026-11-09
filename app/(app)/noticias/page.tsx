import { Card, Text } from "@mantine/core";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Notícias" };

export default function Page() {
  return (
    <>
      <PageHeader title="Notícias" />
      <Card>
        <Text c="dimmed" size="sm">Feeds RSS e temas chegam na etapa 7.</Text>
      </Card>
    </>
  );
}
