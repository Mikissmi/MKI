import type { Interval } from "@/lib/agenda/free-slots";

export type BlockKind = "leitura" | "atividade" | "habito" | "pausa" | "mini_vitoria" | "exercicio" | "artigo" | "podcast" | "ajuste";
export type ScreenType = "com_tela" | "sem_tela";
export type EnergyLevel = "baixa" | "media" | "alta";

export type PlanBlock = {
  startMin: number;
  durationMin: number;
  kind: BlockKind;
  title: string;
  reason: string;
  screen: ScreenType | null;
  refType: string | null;
  refId: string | null;
};

export type PlanContext = {
  date: string;
  /** minutos agora (só para hoje); null em outros dias */
  nowMin: number | null;
  wake: number;
  sleep: number;
  /** compromissos + rotina + blocos já aceitos */
  busy: Interval[];
  mood: number | null;
  energy: number | null;
  /** energia 1–2 ou Dia leve ligado manualmente */
  lightDay: boolean;
  pendingHabits: { id: string; name: string; routine: string | null }[];
  readingQueue: { id: string; title: string; kind: string }[];
  shortArticles: { id: string; title: string }[];
  activities: { id: string; name: string; minutes: number; energy: EnergyLevel; screen: ScreenType; daysSince: number | null }[];
  quickWins: { id: string; title: string; minutes: number; energy: EnergyLevel; screen: ScreenType }[];
  /** minutos já registrados hoje */
  screenMinutes: { com: number; sem: number };
  /** refIds a evitar (ao "trocar" uma sugestão) */
  exclude?: string[];
  /** blocos flexíveis de hoje (a IA pode propor mover o início dentro da janela) */
  flexBlocks: { blockId: string; title: string; startMin: number; durationMin: number; earliest: number; latest: number; confirmed: boolean }[];
  /** trechos de deslocamento de hoje em blocos que pedem sugestões no trajeto */
  travelSlots: { startMin: number; endMin: number }[];
  podcasts: { id: string; title: string }[];
};

export const LIGHT_DAY_MAX_ITEMS = 3;
export const STALE_ACTIVITY_DAYS = 7; // decisão fechada: prioridade sobe depois de 7 dias parada
