import { z } from "zod";
import { isDateKey, parseTime } from "@/lib/time";

/** Peças de validação reutilizadas por todos os módulos (os valores chegam como texto de formulários). */
export const parseDecimal = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : NaN;
};

const NUM_ERR = { error: "Número inválido" };

export const id = z.string().uuid().optional().or(z.literal("").transform(() => undefined));
export const uuid = z.string().uuid("Escolha uma opção");
export const optUuid = z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().uuid().nullable());
export const text = (max = 200) => z.string().trim().min(1, "Preencha este campo").max(max);
export const optText = (max = 1000) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));
export const url = () => optText(1000).pipe(z.string().regex(/^https?:\/\/\S+$/i, "Use um link que comece com http ou https").nullable());

export const optInt = (min: number, max: number) =>
  z.string().optional().transform((v) => (v === undefined ? null : parseDecimal(v))).pipe(z.number(NUM_ERR).int("Use um número inteiro").min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`).nullable());
export const reqInt = (min: number, max: number) =>
  z.string().transform((v) => parseDecimal(v)).pipe(z.number(NUM_ERR).int("Use um número inteiro").min(min, `Mínimo ${min}`).max(max, `Máximo ${max}`));
export const optNum = (min: number, max: number) =>
  z.string().optional().transform((v) => (v === undefined ? null : parseDecimal(v))).pipe(z.number(NUM_ERR).min(min).max(max).nullable());

/** Dinheiro digitado ("12,50" ou "1.234,56") -> centavos */
const toCents = (v: string | undefined) => { const n = v === undefined ? null : parseDecimal(v); return n === null ? null : Math.round(n * 100); };
export const moneyCents = () => z.string().transform(toCents).pipe(z.number(NUM_ERR).int().min(1, "Informe um valor maior que zero").max(100_000_000_00));
export const optMoneyCents = () => z.string().optional().transform(toCents).pipe(z.number(NUM_ERR).int().min(0).max(100_000_000_00).nullable());

export const reqDate = z.string().refine(isDateKey, "Data inválida");
export const optDate = z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().refine(isDateKey, "Data inválida").nullable());
export const time = z.string().refine((s) => parseTime(s) !== null, "Horário inválido");
export const optTime = z.string().optional().transform((v) => (v ? v : null)).pipe(z.string().refine((s) => parseTime(s) !== null, "Horário inválido").nullable());

export const oneOf = <T extends readonly [string, ...string[]]>(vals: T) => z.enum(vals, { error: "Escolha uma opção" });
export const optOneOf = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.string().optional().transform((v) => (v ? v : null)).pipe(z.enum(vals).nullable());
export const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
export const tags = z.string().optional().transform((v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20).map((s) => s.slice(0, 40)));
export const weekdays = z.array(z.coerce.number().int().min(0).max(6)).default([]);
export const rating = optInt(1, 5);
