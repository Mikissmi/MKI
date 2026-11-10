import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanCustom, CUSTOM_MAX, DEFAULT_CUSTOM, KITS, resolveShortcuts, SHORTCUTS } from "./shortcuts";
import { ICONS } from "./icons";

describe("atalhos do ícone", () => {
  it("21 atalhos, chaves únicas, nomes curtos, rotas e ícones existentes", () => {
    expect(SHORTCUTS).toHaveLength(21);
    expect(new Set(SHORTCUTS.map((s) => s.key)).size).toBe(21);
    for (const s of SHORTCUTS) {
      expect(s.short.length).toBeLessThanOrEqual(12);
      expect(s.url.startsWith("/")).toBe(true);
      expect(ICONS[s.icon], s.key).toBeDefined();
      expect(existsSync(`public/icons/shortcuts/${s.key}.png`), `ícone de ${s.key}`).toBe(true);
    }
  });
  it("6 kits com 4 atalhos válidos cada", () => {
    expect(KITS).toHaveLength(6);
    for (const k of KITS) { expect(k.items).toHaveLength(4); for (const i of k.items) expect(SHORTCUTS.some((s) => s.key === i), `${k.key}:${i}`).toBe(true); }
  });
  it("kit personalizado: só chaves conhecidas, sem repetir, no máximo 4, padrão se vazio", () => {
    expect(cleanCustom(["gasto", "gasto", "xx", "agua", "humor", "ideia", "hoje"])).toEqual(["gasto", "agua", "humor", "ideia"]);
    expect(cleanCustom([])).toEqual(DEFAULT_CUSTOM);
    expect(cleanCustom("x")).toEqual(DEFAULT_CUSTOM);
    expect(cleanCustom(["a", "b"]).length).toBeLessThanOrEqual(CUSTOM_MAX);
  });
  it("resolveShortcuts respeita o kit e a ordem", () => {
    expect(resolveShortcuts("rapido", []).map((s) => s.key)).toEqual(["gasto", "agua", "humor", "ideia"]);
    expect(resolveShortcuts("custom", ["sono", "hoje"]).map((s) => s.key)).toEqual(["sono", "hoje"]);
    expect(resolveShortcuts("inexistente", ["viagens"]).map((s) => s.key)).toEqual(["viagens"]);
  });
});
