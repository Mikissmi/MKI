import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyHttpError, geminiProvider } from "./gemini";
import { AiError } from "./types";

const body = (message: string, status = "") => ({ error: { message, status } });

describe("classificação dos erros do Gemini", () => {
  it("429 = cota", () => expect(classifyHttpError(429, body("quota exceeded")).reason).toBe("quota"));
  it("401 e 403 = chave/permissão/região", () => {
    expect(classifyHttpError(403, body("User location is not supported for the API use.")).reason).toBe("auth");
    expect(classifyHttpError(401, null).reason).toBe("auth");
  });
  it("400 com 'API key not valid' = chave recusada; outro 400 = http", () => {
    expect(classifyHttpError(400, body("API key not valid. Please pass a valid API key.", "INVALID_ARGUMENT")).reason).toBe("auth");
    expect(classifyHttpError(400, body("Invalid JSON payload")).reason).toBe("http");
  });
  it("404 = modelo inexistente; 500 = http", () => {
    expect(classifyHttpError(404, body("models/x is not found")).reason).toBe("model");
    expect(classifyHttpError(503, null).reason).toBe("http");
  });
  it("guarda um detalhe curto para mostrar na tela", () => {
    const e = classifyHttpError(400, body("API key not valid. ".repeat(40)));
    expect(e.detail!.length).toBeLessThanOrEqual(220);
    expect(e.status).toBe(400);
  });
});

describe("provedor Gemini", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const ok = (text: string, finishReason = "STOP") => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }), { status: 200 });
  const fail = (status: number, message: string) => new Response(JSON.stringify(body(message)), { status });

  it("sem chave não há provedor", () => { vi.stubEnv("GEMINI_API_KEY", ""); expect(geminiProvider()).toBeNull(); });
  it("se o apelido do modelo não existir (404), tenta o modelo fixo", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k"); vi.stubEnv("GEMINI_MODEL", "");
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: string) => { urls.push(u); return u.includes("gemini-flash-latest") ? fail(404, "not found") : ok("oi"); }));
    const text = await geminiProvider()!.generate({ system: "s", prompt: "p" });
    expect(text).toBe("oi");
    expect(urls.map((u) => u.match(/models\/([^:]+):/)![1])).toEqual(["gemini-flash-latest", "gemini-2.5-flash"]);
  });
  it("com GEMINI_MODEL definido usa só esse e o 404 vira erro de modelo", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k"); vi.stubEnv("GEMINI_MODEL", "meu-modelo");
    const f = vi.fn(async () => fail(404, "models/meu-modelo is not found")); vi.stubGlobal("fetch", f);
    await expect(geminiProvider()!.generate({ system: "s", prompt: "p" })).rejects.toMatchObject({ reason: "model" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("resposta JSON cortada pelo limite de tokens é tratada como formato inválido", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k"); vi.stubEnv("GEMINI_MODEL", "m");
    vi.stubGlobal("fetch", vi.fn(async () => ok('{"reply":"oi","blocks":[', "MAX_TOKENS")));
    const err = await geminiProvider()!.generate({ system: "s", prompt: "p", json: true }).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.reason).toBe("format");
  });
  it("mensagem bloqueada pelo Google vira erro de formato com o motivo", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k"); vi.stubEnv("GEMINI_MODEL", "m");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })));
    const err = await geminiProvider()!.generate({ system: "s", prompt: "p" }).catch((e) => e);
    expect(err.reason).toBe("format");
    expect(err.detail).toContain("SAFETY");
  });
  it("a chave vai no cabeçalho, nunca na URL", async () => {
    vi.stubEnv("GEMINI_API_KEY", "segredo123"); vi.stubEnv("GEMINI_MODEL", "m");
    let seen: { url: string; headers: Record<string, string> } | null = null;
    vi.stubGlobal("fetch", vi.fn(async (u: string, init: RequestInit) => { seen = { url: u, headers: init.headers as Record<string, string> }; return ok("x"); }));
    await geminiProvider()!.generate({ system: "s", prompt: "p" });
    expect(seen!.url).not.toContain("segredo123");
    expect(seen!.headers["x-goog-api-key"]).toBe("segredo123");
  });
});
