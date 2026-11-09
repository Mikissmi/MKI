import type { Field } from "@/components/forms/FormSheet";

export const READING_STATUS = {
  livro: [{ value: "quero", label: "Quero ler" }, { value: "lendo", label: "Lendo" }, { value: "lido", label: "Lido" }, { value: "abandonado", label: "Abandonado" }],
  artigo: [{ value: "quero", label: "Para ler" }, { value: "lido", label: "Lido" }, { value: "arquivado", label: "Arquivado" }],
  obra: [{ value: "lendo", label: "Lendo" }, { value: "quero", label: "Quero ler" }, { value: "lido", label: "Concluída" }, { value: "abandonado", label: "Abandonada" }],
} as const;
export const SERIAL_STATUS = [{ value: "em_dia", label: "Em dia" }, { value: "aguardando", label: "Aguardando novo capítulo" }, { value: "pausada", label: "Pausada" }];

/** Campos do formulário por tipo de leitura. */
export function readingFields(kind: "livro" | "artigo" | "obra"): Field[] {
  const status: Field = { name: "status", label: "Status", type: "select", options: [...READING_STATUS[kind]] };
  const tags: Field = { name: "tags", label: "Tags (separe por vírgula)", placeholder: "ficção, favoritos" };
  if (kind === "livro") return [
    { name: "title", label: "Título", required: true, maxLength: 200 }, { name: "author", label: "Autor(a)", maxLength: 120 }, status,
    { name: "total_pages", label: "Total de páginas", type: "decimal" }, { name: "current_page", label: "Página atual", type: "decimal" },
    { name: "cover_url", label: "Link da capa", type: "url" }, { name: "rating", label: "Nota (1 a 5)", type: "decimal" },
    { name: "started_on", label: "Começou em", type: "date" }, { name: "finished_on", label: "Terminou em", type: "date" },
    { name: "review", label: "Resenha", type: "textarea" }, tags,
  ];
  if (kind === "artigo") return [
    { name: "url", label: "Link", type: "url", required: true }, { name: "title", label: "Título (vazio = automático)", maxLength: 200 }, status,
    { name: "minutes_hint", label: "Tempo de leitura (minutos)", type: "decimal" }, tags,
  ];
  return [
    { name: "title", label: "Título", required: true, maxLength: 200 }, { name: "author", label: "Autor(a)", maxLength: 120 }, status,
    { name: "serial_status", label: "Situação", type: "select", options: SERIAL_STATUS }, { name: "last_chapter", label: "Último capítulo lido", maxLength: 80 },
    { name: "url", label: "Link para continuar", type: "url" }, { name: "cover_url", label: "Link da capa", type: "url" }, tags,
  ];
}

export type ReadingRow = {
  id: string; kind: "livro" | "artigo" | "obra"; title: string; author: string | null; status: string; serial_status: string | null; current_page: number | null; total_pages: number | null;
  last_chapter: string | null; url: string | null; cover_url: string | null; rating: number | null; review: string | null; tags: string[]; minutes_hint: number | null;
  started_on: string | null; finished_on: string | null; source: string;
};
export const READING_COLS = "id, kind, title, author, status, serial_status, current_page, total_pages, last_chapter, url, cover_url, rating, review, tags, minutes_hint, started_on::text AS started_on, finished_on::text AS finished_on, source";

export const readingValues = (r: ReadingRow) => ({
  id: r.id, title: r.title, author: r.author, status: r.status, serial_status: r.serial_status ?? "", current_page: r.current_page, total_pages: r.total_pages, last_chapter: r.last_chapter,
  url: r.url, cover_url: r.cover_url, rating: r.rating, review: r.review, tags: r.tags.join(", "), minutes_hint: r.minutes_hint, started_on: r.started_on, finished_on: r.finished_on,
});

export const progressPct = (r: Pick<ReadingRow, "current_page" | "total_pages">) => (r.total_pages ? Math.min(100, Math.round(((r.current_page ?? 0) / r.total_pages) * 100)) : 0);
export const domainOf = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : ""; } catch { return ""; } };
