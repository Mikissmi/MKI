import { query } from "@/lib/db";

/** Tabelas do usuário, na ordem em que podem ser restauradas (pais antes dos filhos). */
export const EXPORT_TABLES = [
  { table: "categories", label: "Categorias" }, { table: "habits", label: "Hábitos" }, { table: "quick_wins", label: "Mini-vitórias" }, { table: "topics", label: "Temas" }, { table: "feeds", label: "Feeds" },
  { table: "recipes", label: "Receitas" }, { table: "trips", label: "Viagens" }, { table: "creative_projects", label: "Projetos criativos" }, { table: "reading_items", label: "Leituras" },
  { table: "activities", label: "Atividades" }, { table: "projects", label: "Projetos" }, { table: "playlists", label: "Playlists" }, { table: "audio_items", label: "Música e podcasts" },
  { table: "media_items", label: "Mídia" }, { table: "wishlist_items", label: "Desejos" }, { table: "ideas", label: "Ideias" },
  { table: "habit_logs", label: "Registros de hábitos" }, { table: "reading_notes", label: "Anotações de leitura" }, { table: "reading_logs", label: "Histórico de leitura" }, { table: "activity_logs", label: "Histórico de atividades" },
  { table: "project_steps", label: "Etapas de projetos" }, { table: "news_items", label: "Notícias" }, { table: "meal_plans", label: "Planejamento de refeições" }, { table: "shopping_items", label: "Lista de compras" },
  { table: "cooked_log", label: "O que cozinhei" }, { table: "creative_entries", label: "Versões criativas" }, { table: "inspirations", label: "Inspirações" }, { table: "challenges", label: "Desafios" },
  { table: "creative_sessions", label: "Sessões criativas" }, { table: "trip_days", label: "Roteiros" }, { table: "packing_items", label: "Mala" }, { table: "trip_entries", label: "Diário de viagem" },
  { table: "expenses", label: "Gastos" }, { table: "events", label: "Eventos" }, { table: "routine_blocks", label: "Rotina-modelo" }, { table: "checkins", label: "Check-ins" },
  { table: "sleep_logs", label: "Sono" }, { table: "water_logs", label: "Água" }, { table: "meal_logs", label: "Refeições" }, { table: "workout_logs", label: "Treinos" },
  { table: "body_measures", label: "Medidas" }, { table: "retrospectives", label: "Retrospectivas" },
] as const;

const NAMES = new Set<string>(EXPORT_TABLES.map((t) => t.table));
export const isExportTable = (t: string) => NAMES.has(t);

type Row = Record<string, unknown>;

/** Linhas em JSON feito pelo próprio Postgres: datas como AAAA-MM-DD, números como números, listas como listas. */
async function rowsOf(table: string, userId: string): Promise<Row[]> {
  if (!NAMES.has(table)) throw new Error("tabela inválida");
  const rows = await query<{ r: Row }>(`SELECT row_to_json(t) AS r FROM "${table}" t WHERE t.user_id = $1`, [userId]);
  return rows.map((x) => x.r);
}

export async function exportAll(userId: string) {
  const tables: Record<string, Row[]> = {};
  for (const t of EXPORT_TABLES) tables[t.table] = await rowsOf(t.table, userId);
  const settings = await query<{ data: unknown }>("SELECT data FROM settings WHERE user_id = $1", [userId]);
  return { app: "MKI", version: 1, exportedAt: new Date().toISOString(), settings: settings[0]?.data ?? {}, tables };
}

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  // evita "injeção de fórmula" ao abrir o CSV em planilhas
  const safe = /^[=+\-@]/.test(s) && typeof v === "string" && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function exportCsv(userId: string, table: string): Promise<string> {
  const rows = await rowsOf(table, userId);
  const cols = await query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name <> 'user_id' ORDER BY ordinal_position", [table]);
  const header = cols.map((c) => c.column_name);
  return "﻿" + [header.join(","), ...rows.map((r) => header.map((h) => csvCell(r[h])).join(","))].join("\r\n") + "\r\n";
}

export type ImportResult = { ok: boolean; error?: string; inserted: number; skipped: number; byTable?: Record<string, { inserted: number; skipped: number }> };

/** Restaura um backup JSON. Soma ao que já existe (ids repetidos são ignorados); tudo vira do usuário atual. */
export async function importBackup(userId: string, raw: unknown): Promise<ImportResult> {
  const bad = (error: string): ImportResult => ({ ok: false, error, inserted: 0, skipped: 0 });
  if (!raw || typeof raw !== "object") return bad("Arquivo inválido.");
  const doc = raw as { app?: unknown; version?: unknown; tables?: unknown; settings?: unknown };
  if (doc.app !== "MKI" || doc.version !== 1 || !doc.tables || typeof doc.tables !== "object") return bad("Este arquivo não é um backup do MKI.");
  const tables = doc.tables as Record<string, unknown>;

  const meta = await query<{ table_name: string; column_name: string; is_generated: string }>(
    "SELECT table_name, column_name, is_generated FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1)", [EXPORT_TABLES.map((t) => t.table)]);
  const cols = new Map<string, string[]>();
  for (const m of meta) if (m.is_generated !== "ALWAYS") cols.set(m.table_name, [...(cols.get(m.table_name) ?? []), m.column_name]);

  const result: ImportResult = { ok: true, inserted: 0, skipped: 0, byTable: {} };
  for (const { table } of EXPORT_TABLES) {
    const list = tables[table];
    if (!Array.isArray(list) || list.length === 0) continue;
    const allowed = cols.get(table) ?? [];
    const rows = list.filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r)).map((r) => {
      const o: Row = {};
      for (const k of allowed) if (k in r) o[k] = r[k];
      o.user_id = userId; // nunca confia no usuário do arquivo
      return o;
    });
    const colList = allowed.map((c) => `"${c}"`).join(", ");
    const sql = `INSERT INTO "${table}" (${colList}) SELECT ${colList} FROM json_populate_recordset(null::"${table}", $1::json) ON CONFLICT DO NOTHING RETURNING 1`;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      try {
        inserted += (await query(sql, [JSON.stringify(chunk)])).length;
      } catch {
        // alguma linha do bloco é inválida: tenta uma a uma e pula só as ruins
        for (const row of chunk) { try { inserted += (await query(sql, [JSON.stringify([row])])).length; } catch { /* linha ignorada */ } }
      }
    }
    result.byTable![table] = { inserted, skipped: rows.length - inserted };
    result.inserted += inserted; result.skipped += rows.length - inserted;
  }
  if (doc.settings && typeof doc.settings === "object" && Object.keys(doc.settings).length) {
    await query("INSERT INTO settings (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data || settings.data", [userId, JSON.stringify(doc.settings)]);
  }
  return result;
}
