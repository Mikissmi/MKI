/** Helpers de data/hora no fuso do app (America/Sao_Paulo). Datas locais são strings "YYYY-MM-DD". */
export const TZ = "America/Sao_Paulo";

const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function parts(d: Date): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) o[p.type] = p.value;
  return o;
}

export const localDateKey = (d: Date = new Date()): string => {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
};

export const localMinutes = (d: Date = new Date()): number => {
  const p = parts(d);
  return Number(p.hour) * 60 + Number(p.minute);
};

const utcMs = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUtcMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const isDateKey = (s: unknown): s is string =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromUtcMs(utcMs(s)) === s;

export const addDays = (key: string, n: number) => fromUtcMs(utcMs(key) + n * 86_400_000);
/** 0 = domingo … 6 = sábado */
export const weekday = (key: string) => new Date(utcMs(key)).getUTCDay();
export const dayOfMonth = (key: string) => Number(key.slice(8, 10));
export const startOfWeek = (key: string) => addDays(key, -weekday(key)); // semana começa no domingo
export const startOfMonth = (key: string) => `${key.slice(0, 7)}-01`;
export const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
};
export const daysBetween = (a: string, b: string) => Math.round((utcMs(b) - utcMs(a)) / 86_400_000);
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function offsetMs(ms: number): number {
  const p = parts(new Date(ms));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - Math.floor(ms / 60_000) * 60_000;
}

/** Converte uma data local + minutos desde 00:00 para o instante UTC correspondente. */
export function zonedToUtc(key: string, minutes: number): Date {
  const guess = utcMs(key) + minutes * 60_000;
  let utc = guess - offsetMs(guess);
  const off2 = offsetMs(utc);
  if (guess - off2 !== utc) utc = guess - off2;
  return new Date(utc);
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const fmtMin = (min: number) => `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;

/** "09:30" ou "09:30:00" -> minutos. Devolve null se inválido. */
export function parseTime(s: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${pad2(m)}`;
}

const longFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const noon = (key: string) => new Date(utcMs(key) + 12 * 3_600_000);
export const formatDateLong = (key: string) => longFmt.format(noon(key));
export const formatDateShort = (key: string) => shortFmt.format(noon(key));
export const formatMonth = (key: string) => monthFmt.format(noon(key));

/** Primeira letra maiúscula (o Intl do pt-BR devolve tudo minúsculo). */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
