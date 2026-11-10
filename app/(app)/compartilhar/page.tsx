import { Alert, Button, Stack, Text } from "@mantine/core";
import { PageHeader } from "@/components/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { LinkButton } from "@/components/LinkButton";
import { parseShared, SHARE_DESTS } from "@/lib/share";
import { shareTo } from "./actions";

export const metadata = { title: "Compartilhar" };

/** Destino do "compartilhar" do Android: pergunta onde guardar o link (Ler depois é o padrão). */
export default async function SharePage({ searchParams }: { searchParams: Promise<{ title?: string; text?: string; url?: string; saved?: string; dup?: string; error?: string }> }) {
  const sp = await searchParams;
  const saved = SHARE_DESTS.find((d) => d.key === sp.saved);
  if (saved) {
    return (
      <>
        <PageHeader title="Compartilhar" back="/" />
        <Panel tone="sage" title="Guardado" icon="check">
          <Stack gap="sm">
            <Text role="status">{sp.dup ? `Esse link já estava em ${saved.label}.` : `Guardei em ${saved.label}.`}</Text>
            <LinkButton href={saved.href}>Abrir {saved.label}</LinkButton>
          </Stack>
        </Panel>
      </>
    );
  }
  const shared = parseShared(sp);
  const empty = !shared.url && !shared.title && !shared.text;
  return (
    <>
      <PageHeader title="Compartilhar" back="/" />
      <Stack gap="md">
        {sp.error && <Alert color="red" variant="light" role="alert">{sp.error}</Alert>}
        <Panel tone="plain" title="O que você compartilhou" icon="link">
          {empty ? <Text size="sm" c="dimmed">Nada chegou. No Android, abra um link em outro app, toque em compartilhar e escolha o MKI.</Text> : (
            <Stack gap={4}>
              {shared.title && <Text fw={800}>{shared.title}</Text>}
              {shared.text && <Text size="sm">{shared.text}</Text>}
              {shared.url && <Text size="sm" c="dimmed" style={{ wordBreak: "break-all" }}>{shared.url}</Text>}
            </Stack>
          )}
        </Panel>
        {!empty && (
          <Panel tone="pink" title="Onde guardar?" icon="bookmark">
            <Stack gap="xs">
              {SHARE_DESTS.map((d) => {
                const disabled = d.needsUrl && !shared.url;
                const first = shared.url ? d.key === "ler" : d.key === "ideia";
                return (
                  <form key={d.key} action={shareTo}>
                    <input type="hidden" name="dest" value={d.key} /><input type="hidden" name="title" value={shared.title ?? ""} /><input type="hidden" name="text" value={shared.text ?? ""} /><input type="hidden" name="url" value={shared.url ?? ""} />
                    <Button type="submit" fullWidth size="md" variant={first ? "filled" : "white"} color={first ? undefined : "dark"} disabled={disabled}>{d.label}{first ? " (padrão)" : ""}</Button>
                  </form>
                );
              })}
            </Stack>
          </Panel>
        )}
      </Stack>
    </>
  );
}
