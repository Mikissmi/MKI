export type AiFailReason = "no_key" | "quota" | "timeout" | "http" | "format" | "auth" | "model";

export class AiError extends Error {
  /** `detail` é a mensagem curta devolvida pelo provedor (nunca contém a chave). */
  constructor(public reason: AiFailReason, message?: string, public detail?: string, public status?: number) {
    super(message ?? reason);
  }
}

/** Interface única do provedor: trocar de modelo/provedor é trocar o arquivo apontado em lib/ai/index.ts. */
export interface AiProvider {
  readonly name: string;
  generate(opts: { system: string; prompt: string; json?: boolean }): Promise<string>;
}
