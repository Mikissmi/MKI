export const CATEGORIES = [
  { value: "trabalho", label: "Trabalho", color: "plum" },
  { value: "estudo", label: "Estudo", color: "lavender" },
  { value: "pessoal", label: "Pessoal", color: "lotus" },
  { value: "saude", label: "Saúde", color: "sage" },
  { value: "lazer", label: "Lazer", color: "sun" },
  { value: "outro", label: "Outro", color: "gray" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [CategoryValue, ...CategoryValue[]];
export const categoryColor = (v: string) => CATEGORIES.find((c) => c.value === v)?.color ?? "gray";
export const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
