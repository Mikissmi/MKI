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

export const routineBlockSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
    title: z.string().trim().min(1, "Dê um nome").max(80),
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Escolha ao menos um dia"),
    start: time,
    end: time,
    category: z.enum(CATEGORY_VALUES),
  })
  .refine((v) => parseTime(v.end)! > parseTime(v.start)!, { path: ["end"], message: "O fim precisa ser depois do início" });

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
