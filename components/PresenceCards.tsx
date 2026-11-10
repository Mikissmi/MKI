import Link from "next/link";
import { Box, Button, Group, Stack, Text } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { fmtMin } from "@/lib/time";
import { MEMORY_LABEL, type MemoryItem } from "@/lib/memory";
import type { Focus } from "@/lib/closing";
import { LinkButton } from "@/components/LinkButton";
import { Panel } from "@/components/ui/Panel";
import { continueNormal, notNowMemory, otherMemory, startLightRestart } from "@/app/(app)/presence-actions";

/** 11.7: aparece depois de alguns dias sem abrir o app. Sem atrasos, sem cobrança. */
export function WelcomeBack() {
  return (
    <Panel tone="lavender" title="Que bom te ver de volta" icon="leaf">
      <Stack gap="sm">
        <Text size="sm">Nada ficou atrasado e nenhuma sequência foi quebrada: seus hábitos ficaram em pausa enquanto você esteve fora. Que tal recomeçar com um dia leve, só com o essencial?</Text>
        <Group gap="xs">
          <form action={startLightRestart}><Button type="submit" size="compact-md" leftSection={<Icon name="leaf" size={14} />}>Começar com um Dia leve</Button></form>
          <form action={continueNormal}><Button type="submit" size="compact-md" variant="white" color="dark">Seguir normal</Button></form>
        </Group>
      </Stack>
    </Panel>
  );
}

/** 11.8: um item seu por dia. "Outra" sorteia outro; "Agora não" some até amanhã. */
export function MemoryCard({ item }: { item: MemoryItem }) {
  return (
    <Panel tone="sun" title="Lembra disto?" icon="bookmark">
      <Stack gap="xs">
        <Text size="xs" fw={700}>{MEMORY_LABEL[item.kind]}</Text>
        <Link href={item.href} style={{ color: "inherit", textDecoration: "none" }}>
          <Text fw={700} lh={1.3}>{item.title}</Text>
          {item.detail && <Text size="sm" style={{ opacity: 0.95 }}>{item.detail}</Text>}
        </Link>
        <Group gap="xs">
          <LinkButton href={item.href} size="compact-sm">Abrir</LinkButton>
          <form action={otherMemory}><Button type="submit" size="compact-sm" variant="white" color="dark">Outra</Button></form>
          <form action={notNowMemory}><Button type="submit" size="compact-sm" variant="subtle" color="dark">Agora não</Button></form>
        </Group>
      </Stack>
    </Panel>
  );
}

/** 11.6: as prioridades que você escolheu ontem à noite. */
export function PrioritiesCard({ priorities }: { priorities: string[] }) {
  return (
    <Panel tone="plain" title="Suas prioridades de hoje" icon="target">
      <Stack gap={6}>{priorities.map((p, i) => <Group key={i} gap="xs" wrap="nowrap" align="flex-start"><Icon name="check" size={16} /><Text size="sm" fw={600}>{p}</Text></Group>)}</Stack>
    </Panel>
  );
}

/** 11.9: plano, duas notícias já guardadas e o foco do dia numa única tela. */
export function MorningSummary({ focus, items, news }: { focus: Focus | null; items: { startMin: number; title: string }[]; news: { id: string; title: string; feed: string }[] }) {
  return (
    <Panel tone="sun" title="Resumo da manhã" icon="sunrise">
      <Stack gap="sm">
        {focus && (
          <Box>
            <Text size="xs" fw={700}>{focus.source === "seu" ? "Seu foco de hoje" : "Um trecho seu para hoje"}</Text>
            <Text fw={800} lh={1.3}>{focus.text}</Text>
            {focus.from && <Text size="xs">de {focus.from}</Text>}
          </Box>
        )}
        <Box>
          <Text size="xs" fw={700}>O dia</Text>
          {items.length === 0 ? <Text size="sm">Dia livre por enquanto.</Text> : items.map((it, i) => <Text key={i} size="sm"><b>{fmtMin(it.startMin)}</b> {it.title}</Text>)}
        </Box>
        {news.length > 0 && (
          <Box>
            <Text size="xs" fw={700}>Para ler</Text>
            {news.map((n) => <Link key={n.id} href={`/noticias/${n.id}`} style={{ color: "inherit", textDecoration: "none" }}><Text size="sm" fw={600} lh={1.3}>{n.title} <Text span size="xs" style={{ opacity: 0.95 }}>· {n.feed}</Text></Text></Link>)}
          </Box>
        )}
      </Stack>
    </Panel>
  );
}
