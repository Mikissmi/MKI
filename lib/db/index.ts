import { neon } from "@neondatabase/serverless";

/**
 * Camada única de acesso ao banco. Toda consulta passa por aqui e usa
 * parâmetros ($1, $2...) — nunca texto concatenado.
 * Só roda no servidor: a DATABASE_URL nunca vai para o navegador.
 */
type Runner = (text: string, params: unknown[]) => Promise<unknown[]>;
let runner: Runner | undefined;

async function getRunner(): Promise<Runner> {
  if (runner) return runner;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não está definida");

  const host = new URL(url).hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    // Só para desenvolvimento/testes com um Postgres local; em produção o host é do Neon.
    const pg = await import("pg");
    const Pool = (pg.default ?? pg).Pool;
    const pool = new Pool({ connectionString: url, max: 4 });
    runner = async (text, params) => (await pool.query(text, params as unknown[])).rows;
  } else {
    const client = neon(url);
    runner = async (text, params) => (await client.query(text, params)) as unknown[];
  }
  return runner;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await (await getRunner())(text, params)) as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
