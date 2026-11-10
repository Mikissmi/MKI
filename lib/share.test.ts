import { describe, expect, it } from "vitest";
import { parseShared } from "./share";

describe("compartilhar para o MKI", () => {
  it("usa o link do campo url", () => expect(parseShared({ title: "Bolo", url: "https://exemplo.com/bolo" }).url).toBe("https://exemplo.com/bolo"));
  it("acha o link dentro do texto (YouTube, redes) e tira o link do texto", () => {
    const r = parseShared({ text: "Olha isso https://youtu.be/abc123, muito bom" });
    expect(r.url).toBe("https://youtu.be/abc123");
    expect(r.text).toBe("Olha isso muito bom");
  });
  it("sem link devolve só o texto", () => expect(parseShared({ text: "uma ideia solta" })).toEqual({ url: null, title: null, text: "uma ideia solta" }));
  it("ignora esquemas que não são http", () => expect(parseShared({ text: "javascript:alert(1) ftp://x.com/a" }).url).toBeNull());
  it("limita tamanhos", () => { const r = parseShared({ title: "t".repeat(500), text: "x".repeat(900) }); expect(r.title!.length).toBe(200); expect(r.text!.length).toBe(400); });
  it("vazio", () => expect(parseShared({})).toEqual({ url: null, title: null, text: null }));
});
