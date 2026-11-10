/** Gerador mínimo de iCalendar (RFC 5545) para o calendário assinável. Só títulos e horários. */
export type IcsEvent = { uid: string; title: string; start: Date; end: Date };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** Dobra linhas com mais de 75 bytes (sem cortar um caractere UTF-8 no meio). */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = []; let cur = ""; let bytes = 0; let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; limit = 74; } // as continuações começam com um espaço
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** alarmMin 0 = sem alarme. */
export function buildIcs(events: IcsEvent[], opts: { name: string; alarmMin: number; now?: Date }): string {
  const now = opts.now ?? new Date();
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MKI//Calendario//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`, "X-WR-TIMEZONE:America/Sao_Paulo", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(e.start)}`, `DTEND:${stamp(e.end)}`, `SUMMARY:${esc(e.title)}`);
    if (opts.alarmMin > 0) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${opts.alarmMin}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
