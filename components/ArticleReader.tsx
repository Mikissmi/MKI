"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Group, Loader, Stack, Text } from "@mantine/core";
import { Icon } from "@/lib/icons";
import { summarizeWithAi } from "@/app/(app)/noticias/actions";

type Content = { ok: boolean; paywall: boolean; error: string | null; paragraphs: string[] } | null;

/** Texto da matéria em modo leitura. Se o site bloquear ou exigir assinatura, mostra o resumo e o caminho para o site. */
export function ArticleBody({ newsId, link }: { newsId: string; link: string }) {
  const router = useRouter();
  const [content, setContent] = useState<Content>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch(`/api/news/${newsId}/content`).then((r) => (r.ok ? r.json() : Promise.reject())).then((c) => { if (alive) { setContent(c); if (c.ok) router.refresh(); } }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [newsId, router]);

  if (!content && !failed) return <Group gap="xs" py="md" role="status"><Loader size="xs" color="lotus" /><Text size="sm" c="dimmed">Buscando o texto da matéria...</Text></Group>;
  if (failed || !content?.ok) {
    return (
      <Alert color="yellow" variant="light" title={content?.paywall ? "Conteúdo para assinantes" : "Não consegui trazer o texto"}>
        <Stack gap="xs">
          <Text size="sm">{content?.paywall ? "Este site pede assinatura ou login para ler a matéria completa." : "O site não permitiu a leitura aqui ou a página não tem um texto que dê para extrair."} O resumo acima continua valendo.</Text>
          <Button component="a" href={link} target="_blank" rel="noopener noreferrer" size="compact-md" rightSection={<Icon name="external" size={14} />} style={{ alignSelf: "flex-start" }}>Abrir no site</Button>
        </Stack>
      </Alert>
    );
  }
  return (
    <Stack gap="sm" component="article" aria-label="Texto da matéria">
      {content.paragraphs.map((p, i) => (p.length < 140 && !/[.!?…]$/.test(p)
        ? <Text key={i} fw={800} mt="xs">{p}</Text>
        : <Text key={i} size="md" style={{ lineHeight: 1.65 }}>{p}</Text>))}
    </Stack>
  );
}

export function AiSummaryButton({ newsId }: { newsId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Stack gap={6}>
      <Button size="compact-md" variant="light" color="lavender" loading={pending} leftSection={<Icon name="robot" size={16} />} style={{ alignSelf: "flex-start" }}
        onClick={() => start(async () => { const r = await summarizeWithAi(newsId); setMsg({ ok: r.ok, text: r.ok ? "Resumo atualizado com a IA." : r.error ?? "Não foi possível resumir." }); if (r.ok) router.refresh(); })}>
        Resumir com IA
      </Button>
      {msg && <Text size="xs" role="status" c={msg.ok ? "sage.9" : "dimmed"}>{msg.text}</Text>}
    </Stack>
  );
}
