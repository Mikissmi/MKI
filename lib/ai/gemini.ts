import { AiError, type AiProvider } from "./types";

const TIMEOUT_MS = 15_000;

/** Gemini API (plano gratuito do Google AI Studio). A chave só existe no servidor. */
export function geminiProvider(): AiProvider | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const base = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com";
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  return {
    name: `gemini:${model}`,
    async generate({ system, prompt, json }) {
      let res: Response;
      try {
        res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 1500, ...(json ? { responseMimeType: "application/json" } : {}) },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        throw new AiError(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "http", e instanceof Error ? e.message : undefined);
      }
      if (res.status === 429) throw new AiError("quota");
      if (!res.ok) throw new AiError("http", `HTTP ${res.status}`);
      const data = (await res.json().catch(() => null)) as { candidates?: { content?: { parts?: { text?: string }[] } }[] } | null;
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (!text) throw new AiError("format", "resposta vazia");
      return text;
    },
  };
}
