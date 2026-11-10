import { headers } from "next/headers";
import { Box, Button, Group, NativeSelect, Stack, Text } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { activeToken } from "@/lib/calendar-feed";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { CopyField } from "@/components/CopyField";
import { generateCalendar, revokeCalendar, saveCalendarAlarm } from "./actions";

export const metadata = { title: "Calendário assinável" };

const ALARMS = [{ value: "0", label: "Sem alarme" }, { value: "5", label: "5 minutos antes" }, { value: "10", label: "10 minutos antes" }, { value: "15", label: "15 minutos antes" }, { value: "30", label: "30 minutos antes" }, { value: "60", label: "1 hora antes" }, { value: "120", label: "2 horas antes" }, { value: "1440", label: "1 dia antes" }];

export default async function CalendarSettingsPage() {
  const user = await requireUser();
  const [s, token, h] = await Promise.all([getSettings(user.id), activeToken(user.id), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const url = token ? `${proto}://${host}/api/calendar/${token.code}/mki.ics` : null;
  return (
    <>
      <PageHeader title="Calendário assinável" back="/configuracoes" />
      <Stack gap="md">
        <Panel tone="plain" title="Seu endereço" icon="calendar">
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Assine este endereço no Google Agenda (Outros calendários, Do URL) ou no app de agenda do celular. Aparecem seus eventos, deslocamentos e os blocos do plano que você aceitou.</Text>
            {url ? (
              <>
                <CopyField label="Endereço do calendário" value={url} />
                <Group gap="xs">
                  <form action={generateCalendar}><Button type="submit" variant="white" color="dark" size="compact-md">Gerar outro endereço</Button></form>
                  <form action={revokeCalendar}><Button type="submit" variant="white" color="red.8" size="compact-md">Revogar</Button></form>
                </Group>
                <Text size="xs" c="dimmed">Quem tiver este endereço consegue ver títulos e horários, só para leitura. Se ele vazar, gere outro: o anterior deixa de funcionar na hora.</Text>
              </>
            ) : (
              <form action={generateCalendar}><Button type="submit">Gerar endereço do calendário</Button></form>
            )}
          </Stack>
        </Panel>
        <Panel tone="plain" title="Alarmes" icon="alarm">
          <form action={saveCalendarAlarm}>
            <Stack gap="sm">
              <NativeSelect name="alarm" label="Avisar antes de cada evento" defaultValue={String(s.calendarAlarmMin)} data={ALARMS} />
              <Button type="submit" size="compact-md" variant="light" style={{ alignSelf: "flex-start" }}>Salvar alarme</Button>
            </Stack>
          </form>
        </Panel>
        <Box><Text size="xs" c="dimmed">Os apps de agenda atualizam calendários assinados com atraso, às vezes de horas. Serve melhor para a rotina fixa do que para mudanças de última hora.</Text></Box>
      </Stack>
    </>
  );
}
