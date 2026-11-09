"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { importBackup, type ImportResult } from "@/lib/export";

const MAX_BYTES = 10 * 1024 * 1024;

export async function importAction(_p: ImportResult | null, f: FormData): Promise<ImportResult> {
  const u = await requireUser();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha o arquivo de backup (.json).", inserted: 0, skipped: 0 };
  if (file.size > MAX_BYTES) return { ok: false, error: "Arquivo grande demais (máximo 10 MB).", inserted: 0, skipped: 0 };
  let json: unknown;
  try { json = JSON.parse(await file.text()); } catch { return { ok: false, error: "O arquivo não é um JSON válido.", inserted: 0, skipped: 0 }; }
  const r = await importBackup(u.id, json);
  revalidatePath("/", "layout");
  return r;
}
