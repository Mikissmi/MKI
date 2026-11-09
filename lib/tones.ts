/** Tons pastel do MKI (iguais aos protótipos): fundo do cartão, fundo do ícone, texto forte e cor de destaque. */
export type Tone = "pink" | "sage" | "sun" | "lavender" | "plain";

export const TONES: Record<Tone, { bg: string; tile: string; fg: string; accent: string; border: string }> = {
  pink: {
    bg: "light-dark(#fde8e8, rgba(232,93,151,0.16))", tile: "light-dark(#f8c6d4, rgba(232,93,151,0.32))",
    fg: "light-dark(#7a2448, #f8bad3)", accent: "var(--mantine-color-lotus-5)", border: "light-dark(#f8d3d9, rgba(232,93,151,0.25))",
  },
  sage: {
    bg: "light-dark(#e3f1e0, rgba(130,171,115,0.16))", tile: "light-dark(#c4e2bf, rgba(130,171,115,0.32))",
    fg: "light-dark(#2f5a2a, #c7dabf)", accent: "var(--mantine-color-sage-5)", border: "light-dark(#cfe5ca, rgba(130,171,115,0.25))",
  },
  sun: {
    bg: "light-dark(#fdf1cb, rgba(242,197,52,0.14))", tile: "light-dark(#f8e08c, rgba(242,197,52,0.3))",
    fg: "light-dark(#6b4f06, #fbe598)", accent: "var(--mantine-color-sun-5)", border: "light-dark(#f4e2a6, rgba(242,197,52,0.25))",
  },
  lavender: {
    bg: "light-dark(#ece4f9, rgba(164,125,219,0.16))", tile: "light-dark(#d5c7f1, rgba(164,125,219,0.32))",
    fg: "light-dark(#4a3680, #d6c5f0)", accent: "var(--mantine-color-lavender-5)", border: "light-dark(#dcd0f2, rgba(164,125,219,0.25))",
  },
  plain: {
    bg: "light-dark(#fffdf8, var(--mantine-color-dark-6))", tile: "light-dark(#f5ead9, var(--mantine-color-dark-5))",
    fg: "light-dark(#552640, var(--mantine-color-gray-1))", accent: "var(--mantine-color-lotus-5)", border: "light-dark(#f0e4d2, var(--mantine-color-dark-4))",
  },
};

/** Categoria da agenda -> tom */
export const categoryTone = (c: string): Tone =>
  ({ trabalho: "sage", estudo: "lavender", pessoal: "pink", saude: "sage", lazer: "sun", alimentacao: "sun" } as Record<string, Tone>)[c] ?? "plain";
