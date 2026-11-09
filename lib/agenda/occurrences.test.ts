import { describe, expect, it } from "vitest";
import { expandEvents, expandRoutine, type EventRow } from "./occurrences";
import { freeSlots } from "./free-slots";
import { addMonths, localDateKey, localMinutes, startOfWeek, weekday, zonedToUtc } from "@/lib/time";

const ev = (o: Partial<EventRow>): EventRow => ({
  id: "e1", title: "Aula", date: "2026-11-02", startMin: 600, durationMin: 60, location: null, category: "estudo",
  notes: null, recurrence: "none", recurrenceUntil: null, remindMinutes: null, ...o,
});

describe("expandEvents", () => {
  it("evento único aparece só no seu dia", () => {
    expect(expandEvents([ev({})], "2026-11-01", "2026-11-30").map((o) => o.date)).toEqual(["2026-11-02"]);
  });
  it("semanal repete no mesmo dia da semana e respeita 'até'", () => {
    const o = expandEvents([ev({ recurrence: "weekly", recurrenceUntil: "2026-11-16" })], "2026-11-01", "2026-11-30");
    expect(o.map((x) => x.date)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });
  it("diário não aparece antes da data inicial", () => {
    const o = expandEvents([ev({ recurrence: "daily" })], "2026-10-30", "2026-11-04");
    expect(o.map((x) => x.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
  });
  it("mensal pula meses sem o dia 31", () => {
    const o = expandEvents([ev({ date: "2026-01-31", recurrence: "monthly" })], "2026-01-01", "2026-04-30");
    expect(o.map((x) => x.date)).toEqual(["2026-01-31", "2026-03-31"]);
  });
  it("limita o fim a 24:00", () => {
    const [o] = expandEvents([ev({ startMin: 23 * 60, durationMin: 180 })], "2026-11-02", "2026-11-02");
    expect(o.endMin).toBe(1440);
  });
});

describe("expandRoutine", () => {
  it("só nos dias da semana marcados", () => {
    const o = expandRoutine([{ id: "r", title: "Trabalho", weekdays: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080, category: "trabalho" }], "2026-11-07", "2026-11-10");
    expect(o.map((x) => x.date)).toEqual(["2026-11-09", "2026-11-10"]); // sáb e dom ficam de fora
  });
});

describe("freeSlots", () => {
  it("acha lacunas de 30 min ou mais", () => {
    const f = freeSlots([{ startMin: 540, endMin: 720 }, { startMin: 750, endMin: 1020 }], 420, 1380);
    expect(f).toEqual([
      { startMin: 420, endMin: 540 },
      { startMin: 720, endMin: 750 }, // exatamente 30 min: entra
      { startMin: 1020, endMin: 1380 },
    ]);
  });
  it("ignora lacunas menores que 30 min e junta compromissos sobrepostos", () => {
    const f = freeSlots([{ startMin: 540, endMin: 700 }, { startMin: 600, endMin: 740 }, { startMin: 760, endMin: 800 }], 540, 900);
    expect(f).toEqual([{ startMin: 800, endMin: 900 }]);
  });
  it("sem compromissos, a janela toda é livre", () => {
    expect(freeSlots([], 420, 1380)).toEqual([{ startMin: 420, endMin: 1380 }]);
  });
});

describe("tempo", () => {
  it("meia-noite local de São Paulo é 03:00 UTC", () => {
    expect(zonedToUtc("2026-11-09", 0).toISOString()).toBe("2026-11-09T03:00:00.000Z");
  });
  it("ida e volta fuso <-> UTC", () => {
    const d = zonedToUtc("2026-11-09", 14 * 60 + 30);
    expect(localDateKey(d)).toBe("2026-11-09");
    expect(localMinutes(d)).toBe(870);
  });
  it("semana começa no domingo; mês avança corretamente", () => {
    expect(weekday(startOfWeek("2026-11-11"))).toBe(0);
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });
});
