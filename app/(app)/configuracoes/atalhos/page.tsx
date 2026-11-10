import { Text } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { ShortcutPicker } from "@/components/ShortcutPicker";

export const metadata = { title: "Atalhos" };

export default async function ShortcutsPage() {
  const user = await requireUser();
  const s = await getSettings(user.id);
  return (
    <>
      <PageHeader title="Atalhos" back="/configuracoes" />
      <Panel tone="plain" title="Atalhos do ícone" icon="grid">
        <Text size="sm" c="dimmed" mb="sm">Segurando o ícone do MKI na tela inicial, o celular abre um menu com atalhos que levam direto a uma ação. Só funciona no Android com o app instalado; a lista é fixa e muda quando o celular atualiza o app, não por horário.</Text>
        <ShortcutPicker kit={s.shortcutKit} custom={s.shortcutCustom} />
      </Panel>
    </>
  );
}
