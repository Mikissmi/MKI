import type { Field } from "@/components/forms/FormSheet";
import { CREATIVE_KINDS } from "@/lib/options";

export const projectFields: Field[] = [
  { name: "title", label: "Nome do projeto", required: true, maxLength: 100 }, { name: "kind", label: "Tipo", type: "select", options: CREATIVE_KINDS.map((k) => ({ value: k.value, label: k.label })) },
  { name: "description", label: "Descrição", type: "textarea", maxLength: 1000 }, { name: "cover_url", label: "Link da capa", type: "url" },
];
