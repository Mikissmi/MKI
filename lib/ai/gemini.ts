import { AiError, type AiProvider } from "./types";

const TIMEOUT_MS = 20_000;
/** Sem GEMINI_MODEL definido, tenta o apelido que acompanha o Flash mais novo e, se ele não existir, o modelo fixo. */
const DEFAULT_MODELS = ["gemini-flash-latest", "gemini-2.5-flash"];

let working: string | null = null; // modelo que já respondeu nesta instância

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

const short = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 220) || undefined;

/** Transforma a resposta de erro do Google numa categoria que a pessoa consegue entender. */
export function classifyHttpError(status: number, body: GeminiResponse | null): AiError {
  const detail = short(body?.error?.message);
  const msg = `HTTP ${status}${detail ? `: ${detail}` : ""}`;
  if (status === 429) return new AiError("quota", msg, detail, status);
  if (status === 401 || status === 403) return new AiError("auth", msg, detail, status);
  if (status === 404) return new AiError("model", msg, detail, status);
  if (status === 400 && /api key|api_key|key not valid|permission|location|region/i.test(`${detail} ${body?.error?.status}`)) return new AiError("auth", msg, detail, status);
  return new AiError("http", msg, detail, status);
}

/** Gemini API (plano gratuito do Google AI Studio). A chave só existe no servidor. */
export function geminiProvider(): AiProvider | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const base = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
  const pinned = process.env.GEMINI_MODEL?.trim();
  // o último que funcionou vai primeiro; se ele for descontinuado, volta a tentar a lista
  const candidates = () => (pinned ? [pinned] : working ? [working, ...DEFAULT_MODELS.filter((m) => m !== working)] : DEFAULT_MODELS);

  async function call(model: string, { system, prompt, json }: { system: string; prompt: string; json?: boolean }): Promise<string> {
    let res: Response;
    try {
      res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key! },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          // modelos com "raciocínio" gastam parte do limite pensando: folga para a resposta não ser cortada
          generationConfig: { temperature: 0.6, maxOutputTokens: 4096, ...(json ? { responseMimeType: "application/json" } : {}) },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === "TimeoutError";
      throw new AiError(timeout ? "timeout" : "http", e instanceof Error ? e.message : undefined, timeout ? undefined : "não foi possível conectar ao Google");
    }
    const data = (await res.json().catch(() => null)) as GeminiResponse | null;
    if (!res.ok) throw classifyHttpError(res.status, data);
    const cand = data?.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) {
      const why = data?.promptFeedback?.blockReason ? `bloqueada (${data.promptFeedback.blockReason})` : cand?.finishReason ? `sem texto (${cand.finishReason})` : "resposta vazia";
      throw new AiError("format", why, why);
    }
    if (json && cand?.finishReason === "MAX_TOKENS") throw new AiError("format", "resposta cortada (MAX_TOKENS)", "resposta cortada pelo limite de tamanho");
    return text;
  }

  return {
    name: `gemini:${pinned ?? working ?? DEFAULT_MODELS[0]}`,
    async generate(opts) {
      let last: AiError | null = null;
      for (const model of candidates()) {
        try {
          const out = await call(model, opts);
          working = model;
          return out;
        } catch (e) {
          if (e instanceof AiError && e.reason === "model") { last = e; if (model === working) working = null; continue; } // modelo inexistente: tenta o próximo
          throw e;
        }
      }
      throw last ?? new AiError("model", "nenhum modelo disponível");
    },
  };
}
