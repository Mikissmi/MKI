"use client";

import { useActionState, useState } from "react";
import { Alert, Box, Button, Checkbox, Group, Radio, Stack, Text } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/lib/icons";
import { KITS, SHORTCUTS, CUSTOM_MAX, resolveShortcuts } from "@/lib/shortcuts";
import { saveShortcuts } from "@/app/(app)/configuracoes/atalhos/actions";
import type { FormState } from "@/lib/agenda/schemas";

/** Escolha do kit de atalhos do ícone (6 kits prontos ou 4 atalhos à sua escolha) com prévia da ordem. */
export function ShortcutPicker({ kit: initialKit, custom: initialCustom }: { kit: string; custom: string[] }) {
  const [kit, setKit] = useState(initialKit);
  const [custom, setCustom] = useState<string[]>(initialCustom);
  const [state, action, pending] = useActionState<FormState, FormData>(saveShortcuts, {});
  const preview = resolveShortcuts(kit, custom);
  const toggle = (k: string, on: boolean) => setCustom((c) => (on ? (c.includes(k) ? c : [...c, k]) : c.filter((x) => x !== k)));
  return (
    <ActionForm action={action}>
      <Stack gap="md">
        <Radio.Group value={kit} onChange={setKit} name="kit" label="Kit de atalhos" withAsterisk>
          <Stack gap="xs" mt="xs">
            {KITS.map((k) => (
              <Radio key={k.key} value={k.key} label={<><b>{k.label}</b><Text span size="xs" c="dimmed"> · {k.when}</Text></>} description={k.items.map((i) => SHORTCUTS.find((s) => s.key === i)!.short).join(" · ")} />
            ))}
            <Radio value="custom" label={<b>Kit personalizado</b>} description={`Você escolhe até ${CUSTOM_MAX} atalhos entre os ${SHORTCUTS.length} disponíveis`} />
          </Stack>
        </Radio.Group>

        {kit === "custom" && (
          <Box p="sm" style={{ background: "rgba(0,0,0,0.03)", borderRadius: 16 }}>
            <Text size="sm" fw={700} mb={6}>Escolha até {CUSTOM_MAX} ({custom.length} escolhidos)</Text>
            <Group gap="xs">
              {SHORTCUTS.map((s) => (
                <Checkbox key={s.key} name="custom" value={s.key} label={s.name} checked={custom.includes(s.key)} disabled={!custom.includes(s.key) && custom.length >= CUSTOM_MAX} onChange={(e) => toggle(s.key, e.currentTarget.checked)} />
              ))}
            </Group>
          </Box>
        )}
        {kit !== "custom" && custom.map((k) => <input key={k} type="hidden" name="custom" value={k} />)}

        <div>
          <Text size="sm" fw={700} mb={6}>Como aparece ao segurar o ícone</Text>
          <Stack gap={6}>{preview.map((s, i) => (
            <Group key={s.key} gap="sm" wrap="nowrap"><Icon name={s.icon} size={20} /><Text size="sm" fw={i < 3 ? 800 : 500}>{s.name}</Text>{i === 3 && <Text size="xs" c="dimmed">(o Android pode mostrar só os 3 primeiros)</Text>}</Group>
          ))}</Stack>
        </div>

        {state.error && <Alert color="red" variant="light" role="alert">{state.error}</Alert>}
        {state.ok && <Alert color="green" variant="light" role="status">Salvo. O Android demora um pouco para atualizar o menu do ícone; se não mudar, remova o app da tela inicial e instale de novo.</Alert>}
        <Button type="submit" loading={pending} size="md">Salvar kit</Button>
      </Stack>
    </ActionForm>
  );
}
