import { neon } from "@neondatabase/serverless";

/**
 * Camada única de acesso ao banco. Toda consulta passa por aqui e usa
 * parâmetros ($1, $2...) — nunca texto concatenado.
 * Só roda no servidor: a DATABASE_URL nunca vai para o navegador.
 */
let client: ReturnType<typeof neon> | undefined;

function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não está definida");
    client = neon(url);
  }
  return client;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
