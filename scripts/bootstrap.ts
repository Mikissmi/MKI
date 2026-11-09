// Roda no deploy (script "vercel-build"), antes do `next build`:
//   1. aplica as migrações de db/migrations que ainda não foram aplicadas;
//   2. garante o usuário definitivo a partir de MKI_ADMIN_USER + MKI_ADMIN_PASSWORD.
// Sem DATABASE_URL, pula tudo (build local). Falhas de migração derrubam o deploy de propósito.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { hash, verify } from "@node-rs/argon2";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[bootstrap] DATABASE_URL não definida: nada a fazer.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  // --- 1. migrações (mesma tabela e formato do dbmate, então os dois convivem) ---
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(128) PRIMARY KEY)");
  const applied = new Set((await client.query("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
  const dir = join(process.cwd(), "db", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const version = file.split("_")[0];
    if (applied.has(version)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const up = sql.split("-- migrate:up")[1]?.split("-- migrate:down")[0];
    if (!up) throw new Error(`${file}: bloco "-- migrate:up" não encontrado`);
    console.log(`[bootstrap] aplicando ${file}`);
    await client.query("BEGIN");
    try {
      await client.query(up);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [version]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }

  // --- 2. usuário definitivo ---
  const username = process.env.MKI_ADMIN_USER?.trim();
  const password = process.env.MKI_ADMIN_PASSWORD;
  if (!username || !password) {
    console.log("[bootstrap] MKI_ADMIN_USER/MKI_ADMIN_PASSWORD não definidas: usuário não alterado.");
  } else {
    if (password.length < 10) throw new Error("MKI_ADMIN_PASSWORD precisa ter pelo menos 10 caracteres.");
    const opts = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
    const existing = (await client.query("SELECT id, password_hash FROM users WHERE lower(username) = lower($1)", [username])).rows[0];
    let id: string;
    if (!existing) {
      id = (await client.query("INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id", [username, await hash(password, opts)])).rows[0].id;
      console.log(`[bootstrap] usuário "${username}" criado.`);
    } else {
      id = existing.id;
      const same = await verify(existing.password_hash, password).catch(() => false);
      if (!same) {
        // a senha da variável é a fonte da verdade: trocou lá, troca aqui e encerra as sessões antigas
        await client.query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, await hash(password, opts)]);
        await client.query("DELETE FROM sessions WHERE user_id = $1", [id]);
        console.log(`[bootstrap] senha de "${username}" atualizada.`);
      } else {
        console.log(`[bootstrap] usuário "${username}" já está em dia.`);
      }
    }
    await client.query("INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [id]);
    await client.query("SELECT seed_routine($1)", [id]);
  }
} finally {
  await client.end();
}
