export type AiFailReason = "no_key" | "quota" | "timeout" | "http" | "format";

export class AiError extends Error {
  constructor(public reason: AiFailReason, message?: string) {
    super(message ?? reason);
  }
}

/** Interface única do provedor: trocar de modelo/provedor é trocar o arquivo apontado em lib/ai/index.ts. */
export interface AiProvider {
  readonly name: string;
  generate(opts: { system: string; prompt: string; json?: boolean }): Promise<string>;
}
