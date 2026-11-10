import { describe, expect, it } from "vitest";
import { absenceDays } from "./presence";
import { pickMemory } from "./memory";

describe("boas-vindas de volta", () => {
  it("só depois de N dias sem abrir", () => {
    expect(absenceDays("2026-11-06", "2026-11-08", 3)).toEqual([]);
    expect(absenceDays("2026-11-05", "2026-11-08", 3)).toEqual(["2026-11-06", "2026-11-07"]);
    expect(absenceDays("2026-11-01", "2026-11-08", 7)).toHaveLength(6);
  });
  it("nunca na primeira abertura nem no mesmo dia", () => {
    expect(absenceDays(null, "2026-11-08", 3)).toEqual([]);
    expect(absenceDays("2026-11-08", "2026-11-08", 1)).toEqual([]);
  });
  it("limita a 60 dias pausados", () => expect(absenceDays("2026-01-01", "2026-11-08", 3)).toHaveLength(60));
});

describe("relembrar sem repetir", () => {
  const items = [{ kind: "ideia", id: "1" }, { kind: "ideia", id: "2" }, { kind: "trecho", id: "1" }];
  it("ignora o que saiu há pouco", () => {
    const seen = new Set(["ideia:1", "trecho:1"]);
    for (let i = 0; i < 20; i++) expect(pickMemory(items, seen)).toEqual({ kind: "ideia", id: "2" });
  });
  it("nada novo = nada para mostrar", () => expect(pickMemory(items, new Set(["ideia:1", "ideia:2", "trecho:1"]))).toBeNull());
  it("kind e id contam juntos", () => expect(pickMemory(items, new Set(["ideia:1", "ideia:2"]))).toEqual({ kind: "trecho", id: "1" }));
  it("lista vazia", () => expect(pickMemory([], new Set())).toBeNull());
});
