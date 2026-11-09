import { describe, expect, it } from "vitest";
import { isPendingToday, streak, type HabitDef } from "./habits";

const daily: HabitDef = { id: "h", frequency: "daily", weekdays: [], timesPerWeek: null };

describe("hábitos", () => {
  it("streak diária conta dias seguidos e hoje aberto não quebra", () => {
    const logs = new Set(["2026-11-08", "2026-11-07", "2026-11-06"]);
    expect(streak(daily, logs, "2026-11-09")).toBe(3);
    expect(streak(daily, new Set([...logs, "2026-11-09"]), "2026-11-09")).toBe(4);
  });
  it("lacuna quebra a sequência", () => {
    expect(streak(daily, new Set(["2026-11-08", "2026-11-06"]), "2026-11-09")).toBe(1);
  });
  it("dia leve não quebra a sequência", () => {
    const logs = new Set(["2026-11-08", "2026-11-06"]);
    expect(streak(daily, logs, "2026-11-09", new Set(["2026-11-07"]))).toBe(2);
  });
  it("hábito de dias da semana ignora os outros dias", () => {
    const seg: HabitDef = { id: "h", frequency: "weekdays", weekdays: [1], timesPerWeek: null };
    expect(streak(seg, new Set(["2026-11-09", "2026-11-02"]), "2026-11-10")).toBe(2); // segundas
  });
  it("X vezes por semana: pendente até bater a meta", () => {
    const t3: HabitDef = { id: "h", frequency: "times_per_week", weekdays: [], timesPerWeek: 2 };
    expect(isPendingToday(t3, new Set(["2026-11-09"]), "2026-11-10")).toBe(true);
    expect(isPendingToday(t3, new Set(["2026-11-09", "2026-11-10"]), "2026-11-11")).toBe(false);
  });
});
