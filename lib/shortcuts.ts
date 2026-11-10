import type { Tone } from "@/lib/tones";

/** Atalhos que o celular mostra ao segurar o ícone do app (manifesto). Os 21 atalhos do doc (seção 11.2). */
export type Shortcut = { key: string; name: string; short: string; icon: string; url: string; tone: Tone };

export const SHORTCUTS: Shortcut[] = [
  { key: "gasto", name: "Registrar gasto", short: "Gasto", icon: "wallet", url: "/quick/gasto", tone: "pink" },
  { key: "agua", name: "Beber água", short: "Água", icon: "droplet", url: "/quick/agua", tone: "sage" },
  { key: "humor", name: "Como estou", short: "Como estou", icon: "mood-4", url: "/quick/humor", tone: "sun" },
  { key: "ideia", name: "Nova ideia", short: "Ideia", icon: "bulb", url: "/quick/ideia", tone: "pink" },
  { key: "ler-depois", name: "Ler depois", short: "Ler depois", icon: "link", url: "/quick/ler-depois", tone: "sage" },
  { key: "continuar-leitura", name: "Continuar leitura", short: "Continuar", icon: "book2", url: "/quick/continuar-leitura", tone: "lavender" },
  { key: "noticias", name: "Notícias", short: "Notícias", icon: "news", url: "/noticias", tone: "sun" },
  { key: "trilha", name: "Trilha do dia", short: "Trilha", icon: "music", url: "/quick/trilha", tone: "pink" },
  { key: "hoje", name: "Hoje", short: "Hoje", icon: "sun", url: "/", tone: "sun" },
  { key: "plano", name: "Plano do dia", short: "Plano", icon: "calendar", url: "/agenda?v=dia", tone: "lavender" },
  { key: "checkin", name: "Check-in", short: "Check-in", icon: "mood-beam", url: "/?checkin=1", tone: "sun" },
  { key: "agenda", name: "Agenda", short: "Agenda", icon: "event", url: "/agenda", tone: "lavender" },
  { key: "sono", name: "Registrar sono", short: "Sono", icon: "bed", url: "/quick/sono", tone: "lavender" },
  { key: "exercicio", name: "Registrar exercício", short: "Exercício", icon: "run", url: "/quick/exercicio", tone: "sage" },
  { key: "fechamento", name: "Fechamento da noite", short: "Fechar o dia", icon: "moon", url: "/fechamento", tone: "lavender" },
  { key: "habitos", name: "Hábitos de hoje", short: "Hábitos", icon: "check", url: "/quick/habitos", tone: "sage" },
  { key: "retrospectiva", name: "Retrospectiva", short: "Retro", icon: "chart", url: "/retrospectivas", tone: "sun" },
  { key: "sessao", name: "Sessão criativa", short: "Criar", icon: "brush", url: "/estudio", tone: "pink" },
  { key: "receita", name: "Nova receita", short: "Receita", icon: "chef", url: "/receitas", tone: "sun" },
  { key: "desejos", name: "Lista de desejos", short: "Desejos", icon: "gift", url: "/desejos", tone: "pink" },
  { key: "viagens", name: "Viagens", short: "Viagens", icon: "plane", url: "/viagens", tone: "sage" },
];

const byKey = new Map(SHORTCUTS.map((s) => [s.key, s]));
export const shortcutByKey = (k: string) => byKey.get(k);

/** Os seis kits prontos; os três primeiros de cada um são os que o Android mostra com certeza. */
export const KITS: { key: string; label: string; when: string; items: string[] }[] = [
  { key: "rapido", label: "Registro rápido", when: "Quando algo acontece na hora: gastou, bebeu água, teve uma ideia", items: ["gasto", "agua", "humor", "ideia"] },
  { key: "meu-dia", label: "Meu dia", when: "De manhã e nas pausas", items: ["plano", "checkin", "habitos", "agenda"] },
  { key: "leitura-musica", label: "Leitura e música", when: "No tempo livre e no deslocamento", items: ["ler-depois", "continuar-leitura", "trilha", "noticias"] },
  { key: "bem-estar", label: "Bem-estar", when: "Em dias de pouca energia", items: ["humor", "agua", "sono", "exercicio"] },
  { key: "noite", label: "Noite", when: "No fim do dia", items: ["fechamento", "habitos", "retrospectiva", "sono"] },
  { key: "criar-guardar", label: "Criar e guardar", when: "Em fins de semana e nos hobbies", items: ["sessao", "receita", "desejos", "viagens"] },
];

export const DEFAULT_CUSTOM = ["gasto", "agua", "humor", "ideia"];
export const CUSTOM_MAX = 4;

/** Mantém só chaves conhecidas, sem repetir, até 4. Se sobrar vazio, usa o padrão. */
export function cleanCustom(keys: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(keys)) for (const k of keys) if (typeof k === "string" && byKey.has(k) && !out.includes(k) && out.length < CUSTOM_MAX) out.push(k);
  return out.length ? out : [...DEFAULT_CUSTOM];
}

/** Lista final de atalhos (na ordem) para o kit escolhido; "custom" usa os 4 escolhidos. */
export function resolveShortcuts(kit: string, custom: string[]): Shortcut[] {
  const keys = kit === "custom" ? cleanCustom(custom) : (KITS.find((k) => k.key === kit)?.items ?? cleanCustom(custom));
  return keys.map((k) => byKey.get(k)!).filter(Boolean);
}
