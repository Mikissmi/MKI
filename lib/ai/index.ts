import { geminiProvider } from "./gemini";
import type { AiProvider } from "./types";

export * from "./types";

/** Único ponto que decide qual provedor de IA o app usa. */
export function getProvider(): AiProvider | null {
  return geminiProvider();
}
