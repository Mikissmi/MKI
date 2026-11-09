import { redirect } from "next/navigation";
import { Card, Center, Stack, Text, Title } from "@mantine/core";
import { getSessionUser } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <Center mih="100dvh" p="md">
      <Card w="100%" maw={380} padding="xl">
        <Stack align="center" gap="xs" mb="lg">
          <Logo size={72} />
          <Title order={1}>MKI</Title>
          <Text c="dimmed" size="sm">Seu painel pessoal</Text>
        </Stack>
        <LoginForm />
      </Card>
    </Center>
  );
}
