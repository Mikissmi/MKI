import type { Accent } from "@/lib/settings";

/** Paletas da cor de destaque: substituem a escala "lotus" (a cor primária do app inteiro). */
export const ACCENTS: Record<Accent, { label: string; scale: string[] }> = {
  lotus: { label: "Rosa", scale: ["#fff0f6", "#fcdbe8", "#f8bad3", "#f395bc", "#ee77a8", "#e85d97", "#c43f7b", "#ad366a", "#8a2a55", "#681f40"] },
  sage: { label: "Verde", scale: ["#f1f6ef", "#e0ebdb", "#c7dabf", "#aac79e", "#93b885", "#82ab73", "#6c935e", "#567649", "#415937", "#2c3c25"] },
  sun: { label: "Amarelo", scale: ["#fff9e5", "#fdf0c0", "#fbe598", "#f8d96d", "#f5cf4b", "#f2c534", "#d6a921", "#ae8517", "#85650f", "#5c4508"] },
  lavender: { label: "Lavanda", scale: ["#f5f1fc", "#e8def7", "#d6c5f0", "#c2a9e8", "#b292e1", "#a47ddb", "#8a62c2", "#6f4ca0", "#55397d", "#3c2859"] },
};

/** CSS que troca as variáveis da escala "lotus" (não faz nada para o rosa padrão). */
export function accentCss(accent: Accent): string | null {
  if (accent === "lotus") return null;
  const s = ACCENTS[accent].scale;
  return `:root{${s.map((c, i) => `--mantine-color-lotus-${i}:${c};`).join("")}--mantine-color-lotus-filled:${s[5]};--mantine-color-lotus-filled-hover:${s[6]};--mantine-color-lotus-light:${s[1]}66;--mantine-color-lotus-light-hover:${s[1]}99;--mantine-color-lotus-light-color:${s[7]};--mantine-color-lotus-outline:${s[5]};}`;
}
