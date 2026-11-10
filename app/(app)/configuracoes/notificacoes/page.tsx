import { Stack, Text } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { pushConfig } from "@/lib/push/config";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { NotifyForm, PushDevice } from "@/components/NotifySettings";

export const metadata = { title: "Notificações" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const [s] = await Promise.all([getSettings(user.id)]);
  const c = pushConfig();
  return (
    <>
      <PageHeader title="Notificações" back="/configuracoes" />
      <Stack gap="md">
        <Panel tone="pink" title="Neste aparelho" icon="bell">
          <PushDevice publicKey={c.publicKey} configured={c.configured} />
        </Panel>
        <Panel tone="plain" title="Avisos" icon="alarm">
          <NotifyForm initial={s.notify} />
        </Panel>
        {c.configured && !c.cronConfigured && <Text size="xs" c="dimmed">Falta o CRON_SECRET no servidor: sem ele o agendador não consegue pedir os avisos (só a notificação de teste funciona).</Text>}
        <Text size="xs" c="dimmed">Os avisos são decididos por um agendador externo gratuito que chama o app a cada poucos minutos (veja o README). No iPhone, só funcionam com o app instalado na tela inicial, e botões dentro da notificação não são confiáveis.</Text>
      </Stack>
    </>
  );
}
