import { describe, expect, it } from "vitest";
import { busyIntervals, expandEvents, expandRoutine, type EventRow, type RoutineBlock, type RoutineOverride } from "./occurrences";
import { freeSlots } from "./free-slots";
import { addMonths, localDateKey, localMinutes, startOfWeek, weekday, zonedToUtc } from "@/lib/time";

const fixedBlock = (o: Partial<RoutineBlock> = {}): RoutineBlock => ({
  id: "r", title: "Trabalho", weekdays: [1, 2, 3, 4, 5], startMin: 540, endMin: 1080, category: "trabalho", mode: "fixed",
  startEarliest: null, startLatest: null, preferredStart: null, durationMin: null, travelTo: 0, travelFrom: 0, travelMode: null, travelSuggestions: false, ...o,
});
/** Trabalho flexível do exemplo do doc: janela 08:00–10:00, 8 h, ida 40 min, volta 50 min. */
const flexBlock = (o: Partial<RoutineBlock> = {}): RoutineBlock => fixedBlock({
  mode: "flexible", startEarliest: 480, startLatest: 600, preferredStart: 480, startMin: 480, endMin: 960, durationMin: 480, travelTo: 40, travelFrom: 50, travelMode: "onibus", ...o,
});
const MON = "2026-11-09"; // segunda
const ov = (o: Partial<RoutineOverride> = {}): RoutineOverride => ({ id: "ov1", blockId: "r", date: MON, startActual: null, skipTravel: false, canceled: false, ...o });
const spans = (occs: ReturnType<typeof expandRoutine>) => occs.map((x) => `${x.kind}:${x.direction ?? "bloco"}:${Math.floor(x.startMin / 60)}:${String(x.startMin % 60).padStart(2, "0")}-${Math.floor(x.endMin / 60)}:${String(x.endMin % 60).padStart(2, "0")}`);

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
    const o = expandRoutine([fixedBlock()], "2026-11-07", "2026-11-10");
    expect(o.map((x) => x.date)).toEqual(["2026-11-09", "2026-11-10"]); // sáb e dom ficam de fora
  });
});

describe("rotina flexível e deslocamento (10.2)", () => {
  it("exemplo do doc: início 09:00, 8 h, ida 40 min, volta 50 min -> deslocamentos 08:20–09:00 e 17:00–17:50", () => {
    const o = expandRoutine([flexBlock()], MON, MON, [ov({ startActual: 540 })]);
    expect(spans(o)).toEqual(["routine:bloco:9:00-17:00", "travel:ida:8:20-9:00", "travel:volta:17:00-17:50"]);
    expect(o[0].confirmed).toBe(true);
  });
  it("até confirmar o horário real, vale o preferido (e o deslocamento acompanha)", () => {
    const o = expandRoutine([flexBlock({ preferredStart: 510 })], MON, MON);
    expect(spans(o)).toEqual(["routine:bloco:8:30-16:30", "travel:ida:7:50-8:30", "travel:volta:16:30-17:20"]);
    expect(o[0].confirmed).toBe(false);
    expect(o[0].window).toEqual({ earliest: 480, latest: 600 });
  });
  it("confirmar o horário recalcula o tempo livre (o deslocamento não conta como livre)", () => {
    const free = (start: number | null) => {
      const occs = expandRoutine([flexBlock()], MON, MON, start === null ? [] : [ov({ startActual: start })]);
      return freeSlots(busyIntervals(occs), 7 * 60, 23 * 60);
    };
    // preferido 08:00: ocupado 07:20–16:00 + volta até 16:50
    expect(free(null)).toEqual([{ startMin: 1010, endMin: 1380 }]);
    // real 09:00: livre 07:00–08:20 (80 min) e 17:50–23:00
    expect(free(540)).toEqual([{ startMin: 420, endMin: 500 }, { startMin: 1070, endMin: 1380 }]);
  });
  it("bloco fixo também ganha deslocamento; sem tempo de ida/volta não cria nada", () => {
    expect(spans(expandRoutine([fixedBlock({ travelTo: 30, travelFrom: 20 })], MON, MON))).toEqual(["routine:bloco:9:00-18:00", "travel:ida:8:30-9:00", "travel:volta:18:00-18:20"]);
    expect(spans(expandRoutine([fixedBlock()], MON, MON))).toEqual(["routine:bloco:9:00-18:00"]);
  });
  it("só vale nos dias da semana do bloco", () => {
    expect(expandRoutine([flexBlock()], "2026-11-14", "2026-11-15")).toEqual([]); // sáb e dom
  });
  it("exceção 'sem deslocamento' (home office) mantém o bloco e tira só o deslocamento", () => {
    expect(spans(expandRoutine([flexBlock()], MON, MON, [ov({ skipTravel: true })]))).toEqual(["routine:bloco:8:00-16:00"]);
  });
  it("bloco cancelado no dia aparece como cancelado, sem deslocamento e sem ocupar tempo", () => {
    const o = expandRoutine([flexBlock()], MON, MON, [ov({ canceled: true })]);
    expect(o).toHaveLength(1);
    expect(o[0].canceled).toBe(true);
    expect(busyIntervals(o)).toEqual([]);
  });
  it("a exceção vale só no dia dela", () => {
    const o = expandRoutine([flexBlock()], MON, "2026-11-10", [ov({ startActual: 600 })]);
    expect(o.filter((x) => x.kind === "routine").map((x) => x.startMin)).toEqual([600, 480]);
  });
  it("bloco fixo ignora horário real (só o flexível pode mudar)", () => {
    expect(expandRoutine([fixedBlock()], MON, MON, [ov({ startActual: 600 })])[0].startMin).toBe(540);
  });
  it("deslocamento não passa de 00:00 nem de 24:00", () => {
    const o = expandRoutine([fixedBlock({ startMin: 30, endMin: 1430, travelTo: 60, travelFrom: 60 })], MON, MON);
    expect(o.find((x) => x.direction === "ida")).toMatchObject({ startMin: 0, endMin: 30 });
    expect(o.find((x) => x.direction === "volta")).toMatchObject({ startMin: 1430, endMin: 1440 });
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
