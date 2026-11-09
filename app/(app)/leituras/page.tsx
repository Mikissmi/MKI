import { Card, Text } from "@mantine/core";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Leituras" };

export default function Page() {
  return (
    <>
      <PageHeader title="Leituras" />
      <Card>
        <Text c="dimmed" size="sm">Livros, artigos e obras chegam na etapa 5.</Text>
      </Card>
    </>
  );
}
