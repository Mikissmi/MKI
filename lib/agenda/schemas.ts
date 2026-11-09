import { z } from "zod";
import { CATEGORY_VALUES } from "./categories";
import { isDateKey, parseTime } from "@/lib/time";

const dateKey = z.string().refine(isDateKey, "Data inválida");
const time = z.string().refine((s) => parseTime(s) !== null, "Horário inválido");
const optText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : null));

export const eventSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
    title: z.string().trim().min(1, "Dê um título").max(120),
    date: dateKey,
    time,
    duration: z.coerce.number().int().min(5, "Mínimo 5 minutos").max(1440),
    location: optText(160),
    category: z.enum(CATEGORY_VALUES),
    recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
    until: z.string().optional().transform((v) => (v ? v : null)).pipe(dateKey.nullable()),
    remind: z.string().optional().transform((v) => (v === undefined || v === "" ? null : Number(v)))
      .pipe(z.number().int().min(0).max(1440).nullable()),
    notes: optText(2000),
  })
  .superRefine((v, ctx) => {
    const start = parseTime(v.time)!;
    if (start + v.duration > 24 * 60) {
      ctx.addIssue({ code: "custom", path: ["duration"], message: "O evento precisa terminar até 23:59 do mesmo dia" });
    }
    if (v.until && v.until < v.date) {
      ctx.addIssue({ code: "custom", path: ["until"], message: "A repetição não pode terminar antes do início" });
    }
  });

const TRAVEL_MODE_VALUES = ["onibus", "metro", "carro", "a_pe", "bicicleta"] as const;
const minutes = (max: number) => z.string().optional().transform((v) => (v === undefined || v.trim() === "" ? 0 : Number(v.replace(",", ".")))).pipe(z.number({ error: "Número inválido" }).int("Use minutos inteiros").min(0).max(max));
const optTimeStr = z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().refine((s) => parseTime(s) !== null, "Horário inválido").nullable());

/** Horas digitadas ("8" ou "7,5") -> minutos. */
const hoursToMin = (v: string | undefined) => {
  if (v === undefined || v.trim() === "") return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 60) : NaN;
};

export const routineBlockSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
    title: z.string().trim().min(1, "Dê um nome").max(80),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Escolha ao menos um dia"),
    category: z.enum(CATEGORY_VALUES),
    mode: z.enum(["fixed", "flexible"]).catch("fixed"),
    start: optTimeStr, end: optTimeStr,
    earliest: optTimeStr, latest: optTimeStr, preferred: optTimeStr,
    duration_hours: z.string().optional().transform(hoursToMin),
    travel_to: minutes(600), travel_from: minutes(600),
    travel_mode: z.enum(TRAVEL_MODE_VALUES).optional().or(z.literal("").transform(() => undefined)),
    travel_suggestions: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.mode === "fixed") {
      if (!v.start) return bad("start", "Informe o início");
      if (!v.end) return bad("end", "Informe o fim");
      if (parseTime(v.end)! <= parseTime(v.start)!) bad("end", "O fim precisa ser depois do início");
      return;
    }
    if (!v.earliest) return bad("earliest", "Informe o horário mais cedo");
    if (!v.latest) return bad("latest", "Informe o horário mais tarde");
    if (!v.preferred) return bad("preferred", "Informe o horário preferido");
    const e = parseTime(v.earliest)!, l = parseTime(v.latest)!, p = parseTime(v.preferred)!;
    if (l < e) return bad("latest", "O mais tarde não pode ser antes do mais cedo");
    if (p < e || p > l) return bad("preferred", "O preferido precisa estar dentro da janela");
    const d = v.duration_hours;
    if (d === null || Number.isNaN(d)) return bad("duration_hours", "Informe a duração em horas (ex.: 8)");
    if (d < 5 || d > 1439) return bad("duration_hours", "A duração precisa ficar entre 5 minutos e 23h59");
    if (l + d > 1439) bad("duration_hours", "Com o início mais tarde, o bloco passaria da meia-noite");
  });

export const overrideSchema = z.object({
  block_id: z.string().uuid(),
  date: z.string().refine(isDateKey, "Data inválida"),
  start_actual: optTimeStr,
  skip_travel: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  canceled: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

export const hoursSchema = z
  .object({ wake: time, sleep: time })
  .refine((v) => parseTime(v.sleep)! > parseTime(v.wake)!, { path: ["sleep"], message: "Dormir precisa ser depois de acordar" });

export const checkinSchema = z.object({
  mood: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  note: optText(500),
});

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean };

export function zodState(err: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const i of err.issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return { error: Object.values(fieldErrors)[0], fieldErrors };
}
