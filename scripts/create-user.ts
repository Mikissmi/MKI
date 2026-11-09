// Uso: DATABASE_URL=... npm run create-user -- <usuario>
// A senha é pedida no terminal (ou vem de MKI_PASSWORD). Não existe tela de cadastro.
import { createInterface } from "node:readline/promises";
import { neon } from "@neondatabase/serverless";
import { hash } from "@node-rs/argon2";

const username = process.argv[2];
if (!username) {
  console.error("Uso: npm run create-user -- <usuario>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Defina DATABASE_URL.");
  process.exit(1);
}

let password = process.env.MKI_PASSWORD;
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  password = await rl.question("Senha (mín. 10 caracteres): ");
  rl.close();
}
if (password.length < 10) {
  console.error("Senha curta demais.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 });
const rows = await sql.query(
  `INSERT INTO users (username, password_hash) VALUES ($1, $2)
   ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
   RETURNING id`,
  [username, passwordHash],
);
await sql.query("INSERT INTO settings (user_id) VALUES ($1) ON CONFLICT DO NOTHING", [rows[0].id]);
await sql.query("DELETE FROM sessions WHERE user_id = $1", [rows[0].id]);
console.log(`Usuário "${username}" pronto.`);
