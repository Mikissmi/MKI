import { describe, expect, it } from "vitest";
import { avg, delta, pct, periodLabel, pickBestDay } from "./retro-calc";

describe("retrospectiva: cálculos", () => {
  it("melhor dia pondera hábitos, atividades, leitura e humor", () => {
    const best = pickBestDay([
      { date: "2026-11-02", habits: 1, activities: 0, reading: 0, mood: 3 },
      { date: "2026-11-05", habits: 2, activities: 1, reading: 10, mood: 5 }, // 2+1+1+1 = 5
      { date: "2026-11-06", habits: 3, activities: 1, reading: 0, mood: 2 },   // 4
    ]);
    expect(best).toEqual({ date: "2026-11-05", score: 5 });
  });
  it("sem nada feito não há melhor dia; empate fica com o primeiro", () => {
    expect(pickBestDay([{ date: "2026-11-02", habits: 0, activities: 0, reading: 0, mood: 5 }])).toEqual({ date: "2026-11-02", score: 1 });
    expect(pickBestDay([{ date: "a", habits: 0, activities: 0, reading: 0, mood: null }])).toBeNull();
    expect(pickBestDay([{ date: "a", habits: 1, activities: 0, reading: 0, mood: null }, { date: "b", habits: 1, activities: 0, reading: 0, mood: null }])?.date).toBe("a");
  });
  it("rótulo do período", () => {
    expect(periodLabel("semana", 80, 0)).toBe("Semana produtiva");
    expect(periodLabel("mes", 80, 0)).toBe("Mês produtivo");
    expect(periodLabel("semana", 45, 0)).toBe("Semana equilibrada");
    expect(periodLabel("semana", 10, 1)).toBe("Semana leve");
    expect(periodLabel("semana", null, 0)).toBeNull();
  });
  it("médias, porcentagens e comparação", () => {
    expect(avg([3, null, 4])).toBe(3.5);
    expect(avg([null])).toBeNull();
    expect(pct(22, 30)).toBe(73);
    expect(pct(0, 0)).toBeNull();
    expect(delta(10, 7)).toEqual({ text: "+3 vs. anterior", dir: "up" });
    expect(delta(3.5, 4)).toEqual({ text: "-0,5 vs. anterior", dir: "down" });
    expect(delta(5, 5).dir).toBe("same");
    expect(delta(5, null).dir).toBe("none");
  });
});
