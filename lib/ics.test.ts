import { describe, expect, it } from "vitest";
import { buildIcs, fold } from "./ics";

const ev = { uid: "event-1@mki", title: "Consulta; médico, às 10\nsala 2", start: new Date("2026-11-10T13:00:00Z"), end: new Date("2026-11-10T14:00:00Z") };

describe("calendário .ics", () => {
  const ics = buildIcs([ev], { name: "MKI", alarmMin: 15, now: new Date("2026-11-09T12:00:00Z") });
  it("estrutura básica, CRLF e horários em UTC", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261110T130000Z");
    expect(ics).toContain("DTEND:20261110T140000Z");
    expect(ics).toContain("UID:event-1@mki");
  });
  it("escapa vírgula, ponto e vírgula e quebra de linha", () => expect(ics).toContain("SUMMARY:Consulta\\; médico\\, às 10\\nsala 2"));
  it("alarme configurável e opcional", () => {
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(buildIcs([ev], { name: "MKI", alarmMin: 0 })).not.toContain("VALARM");
  });
  it("só título e horário (sem local, notas ou descrição além do alarme)", () => { expect(ics).not.toContain("LOCATION"); expect(ics).not.toContain("DESCRIPTION:Consulta;"); });
  it("dobra linhas longas em até 75 bytes sem quebrar acentos", () => {
    const folded = fold("SUMMARY:" + "ção ".repeat(60));
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "ção ".repeat(60));
  });
});
