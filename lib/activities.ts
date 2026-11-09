import { query } from "@/lib/db";

/** Atividade "Cozinhar" (sem tela): cozinhar uma receita registra aqui, então entra no histórico, no equilíbrio de tela e na retrospectiva. */
export async function ensureCookingActivity(userId: string): Promise<string> {
  const found = await query<{ id: string }>("SELECT id FROM activities WHERE user_id = $1 AND name = 'Cozinhar' LIMIT 1", [userId]);
  if (found[0]) return found[0].id;
  const created = await query<{ id: string }>(
    "INSERT INTO activities (user_id, name, icon, minutes, energy, screen_type) VALUES ($1,'Cozinhar','kitchen',40,'media','sem_tela') RETURNING id", [userId]);
  return created[0].id;
}

/** Linhas de ingredientes de um texto (uma por linha; ignora vazias e marcadores). */
export const ingredientLines = (text: string | null): string[] =>
  (text ?? "").split(/\r?\n/).map((l) => l.replace(/^[-*•\s]+/, "").trim()).filter(Boolean).slice(0, 80);
