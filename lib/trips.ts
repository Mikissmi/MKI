import type { Field } from "@/components/forms/FormSheet";
import type { Tone } from "@/lib/tones";
import { formatDateShort } from "@/lib/time";

export const TRIP_STATUS = [{ value: "quero_ir", label: "Quero ir" }, { value: "planejado", label: "Planejado" }, { value: "visitado", label: "Visitado" }];
export const tripStatusLabel = (s: string) => TRIP_STATUS.find((x) => x.value === s)?.label ?? s;
export const tripStatusTone = (s: string): Tone => (s === "quero_ir" ? "sun" : s === "planejado" ? "lavender" : "sage");

export const tripFields: Field[] = [
  { name: "name", label: "Lugar ou nome da viagem", required: true, maxLength: 100 },
  { name: "status", label: "Status", type: "select", options: TRIP_STATUS },
  { name: "start_on", label: "Ida", type: "date" }, { name: "end_on", label: "Volta", type: "date" },
  { name: "estimated_cost_cents", label: "Custo estimado (R$)", type: "decimal" },
  { name: "link", label: "Link (hospedagem, guia...)", type: "url" }, { name: "cover_url", label: "Link da foto", type: "url" }, { name: "notes", label: "Notas", type: "textarea" },
];

export const tripDates = (a: string | null, b: string | null) => (a && b ? `${formatDateShort(a)} a ${formatDateShort(b)}` : a ? `a partir de ${formatDateShort(a)}` : "sem data definida");
