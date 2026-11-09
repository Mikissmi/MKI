import Link from "next/link";
import { Group, Text } from "@mantine/core";
import { categoryLabel } from "@/lib/agenda/categories";
import { TRAVEL_MODES, type Occurrence } from "@/lib/agenda/occurrences";
import { fmtMin } from "@/lib/time";
import { TONES, categoryTone } from "@/lib/tones";
import { IconTile, Pill } from "@/components/ui/Panel";
import { FormSheet, type Field } from "@/components/forms/FormSheet";
import { removeOverride, saveOverride } from "@/app/(app)/agenda/actions";

const CATEGORY_ICON: Record<string, string> = { trabalho: "briefcase", estudo: "book", pessoal: "heart", saude: "leaf", lazer: "star", outro: "calendar" };
const endLabel = (min: number) => fmtMin(min >= 1440 ? 1439 : min);

/** Abre o seletor do dia: horário real (bloco flexível), "sem deslocamento hoje" e "cancelar hoje". */
function DaySheet({ o, children }: { o: Occurrence; children: React.ReactNode }) {
  const fields: Field[] = [];
  if (o.flexible && o.window) {
    fields.push({
      name: "start_actual", label: "Horário real de hoje", type: "time",
      description: `Janela: ${fmtMin(o.window.earliest)} às ${fmtMin(o.window.latest)}. Até confirmar, vale o horário preferido (${fmtMin(o.preferredStart ?? o.window.earliest)}).`,
    });
  }
  if (o.hasTravel || o.kind === "travel") fields.push({ name: "skip_travel", label: "Sem deslocamento hoje (ex.: home office)", type: "switch" });
  fields.push({ name: "canceled", label: "Cancelar este bloco hoje", type: "switch" });
  const title = o.kind === "travel" ? `Deslocamento · ${o.title}` : o.title;
  return (
    <FormSheet
      title={title} fields={fields} hidden={{ block_id: o.blockId ?? o.id, date: o.date }} action={saveOverride} remove={removeOverride} removeLabel="Voltar ao padrão" submitLabel="Salvar para hoje"
      values={{ id: o.overrideId ?? undefined, start_actual: o.confirmed ? fmtMin(o.startMin) : "", skip_travel: Boolean(o.skipTravel), canceled: Boolean(o.canceled) }}
    >
      {children}
    </FormSheet>
  );
}

/** Um compromisso, bloco da rotina ou deslocamento na linha do tempo (Agenda e Hoje). */
export function OccurrenceCard({ o, past = false }: { o: Occurrence; past?: boolean }) {
  if (o.kind === "travel") {
    const mode = TRAVEL_MODES.find((m) => m.value === o.travelMode);
    const t = TONES.sage;
    return (
      <DaySheet o={o}>
        <Group wrap="nowrap" p="xs" pr="sm" style={{ border: `2px dashed ${t.accent}`, borderRadius: 20, background: "light-dark(rgba(227,241,224,0.45), rgba(130,171,115,0.08))", color: t.fg }}>
          <div style={{ opacity: past ? 0.45 : 1 }}><IconTile icon={mode?.icon ?? "pin"} tone="sage" size={38} round /></div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Text fw={700} size="sm" c="inherit" lh={1.25}>{fmtMin(o.startMin)}–{endLabel(o.endMin)}</Text>
            <Text size="sm" c="inherit" truncate>{o.title}{mode ? ` · ${mode.label}` : ""}</Text>
          </div>
          <Pill tone="sage">{past ? "passou" : "trajeto"}</Pill>
        </Group>
      </DaySheet>
    );
  }

  const tone = categoryTone(o.category);
  const t = TONES[tone];

  if (o.kind === "routine") {
    const card = (
      <Group wrap="nowrap" p="xs" pr="sm" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, color: t.fg }}>
        <div style={{ opacity: past || o.canceled ? 0.45 : 1 }}><IconTile icon={CATEGORY_ICON[o.category] ?? "calendar"} tone={tone} size={42} round /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <Text fw={800} size="sm" c="inherit" lh={1.25} td={o.canceled ? "line-through" : undefined}>{fmtMin(o.startMin)}–{endLabel(o.endMin)}</Text>
          <Text fw={600} size="sm" c="inherit" truncate td={o.canceled ? "line-through" : undefined}>{o.title}</Text>
          {o.flexible && !o.canceled && <Text size="xs" c="inherit" style={{ opacity: 0.9 }}>{o.confirmed ? "horário confirmado" : "toque para confirmar o horário"}</Text>}
        </div>
        {o.canceled ? <Pill tone="plain">cancelado hoje</Pill> : <Pill tone={tone}>{past ? "passou" : o.flexible ? (o.confirmed ? "confirmado" : "flexível") : "rotina"}</Pill>}
      </Group>
    );
    return <DaySheet o={o}>{card}</DaySheet>;
  }

  const card = (
    <Group wrap="nowrap" p="xs" pr="sm" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 20, color: t.fg }}>
      <div style={{ opacity: past ? 0.45 : 1 }}><IconTile icon={CATEGORY_ICON[o.category] ?? "calendar"} tone={tone} size={42} round /></div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text fw={800} size="sm" c="inherit" lh={1.25}>{fmtMin(o.startMin)}</Text>
        <Text fw={600} size="sm" c="inherit" truncate>{o.title}</Text>
        {o.location && <Text size="xs" c="inherit" style={{ opacity: 0.9 }} truncate>{o.location}</Text>}
      </div>
      <Pill tone={tone}>{past ? "passou" : categoryLabel(o.category)}</Pill>
    </Group>
  );
  return <Link href={`/agenda/evento/${o.id}`} style={{ textDecoration: "none", color: "inherit" }}>{card}</Link>;
}
