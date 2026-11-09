import type { Field } from "@/components/forms/FormSheet";

export const recipeFields: Field[] = [
  { name: "title", label: "Nome da receita", required: true, maxLength: 120 },
  { name: "ingredients", label: "Ingredientes (um por linha)", type: "textarea", maxLength: 4000 },
  { name: "steps", label: "Modo de preparo", type: "textarea", maxLength: 8000 },
  { name: "minutes", label: "Tempo (minutos)", type: "decimal" }, { name: "servings", label: "Porções", type: "decimal" },
  { name: "rating", label: "Nota (0 a 5)", type: "decimal", placeholder: "4,5" }, { name: "tags", label: "Tags (separe por vírgula)", placeholder: "saudável, doce, rápida" },
  { name: "photo_url", label: "Link da foto", type: "url" }, { name: "source_url", label: "Link da receita original", type: "url" },
];
