const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (cents: number) => brlFmt.format(cents / 100);
/** Valor para preencher um campo de texto ("12,50"). */
export const moneyInput = (cents: number | null | undefined) => (cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ","));
const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
export const fmtDateKey = (key: string) => dateFmt.format(new Date(`${key}T12:00:00Z`));
