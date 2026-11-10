import { query, queryOne } from "@/lib/db";
import { addDays } from "@/lib/time";

export type MemoryKind = "trecho" | "receita" | "album" | "desejo" | "ideia";
export type MemoryItem = { kind: MemoryKind; id: string; title: string; detail: string | null; href: string };

export const MEMORY_LABEL: Record<MemoryKind, string> = { trecho: "Um trecho que você salvou", receita: "Uma receita parada", album: "Para ouvir", desejo: "Um desejo em espera", ideia: "Uma ideia antiga" };
/** Um item não volta antes deste número de dias. */
export const MEMORY_COOLDOWN_DAYS = 30;

/** Sorteio sem repetir: ignora os itens vistos recentemente (e os que já saíram hoje). Se tudo foi visto, não mostra nada. */
export function pickMemory<T extends { kind: string; id: string }>(candidates: T[], recent: Set<string>, rand: () => number = Math.random): T | null {
  const fresh = candidates.filter((c) => !recent.has(`${c.kind}:${c.id}`));
  return fresh.length ? fresh[Math.floor(rand() * fresh.length)] : null;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

async function candidates(userId: string, today: string): Promise<MemoryItem[]> {
  const old = addDays(today, -7);
  const [notes, recipes, albums, wishes, ideas] = await Promise.all([
    query<{ id: string; quote: string; title: string; item_id: string }>("SELECT n.id, n.quote, r.title, n.item_id FROM reading_notes n JOIN reading_items r ON r.id = n.item_id WHERE n.user_id = $1 AND n.quote IS NOT NULL AND length(trim(n.quote)) > 0", [userId]),
    query<{ id: string; title: string }>("SELECT r.id, r.title FROM recipes r WHERE r.user_id = $1 AND r.created_at < $2::date AND NOT EXISTS (SELECT 1 FROM meal_plans m WHERE m.recipe_id = r.id AND m.date >= $3::date)", [userId, old, addDays(today, -30)]).catch(() => [] as { id: string; title: string }[]),
    query<{ id: string; title: string; creator: string | null }>("SELECT id, title, creator FROM audio_items WHERE user_id = $1 AND status = 'quero' AND kind IN ('album','artista','musica')", [userId]),
    query<{ id: string; name: string }>("SELECT id, name FROM wishlist_items WHERE user_id = $1 AND status IN ('quero','esperando')", [userId]),
    query<{ id: string; text: string }>("SELECT id, text FROM ideas WHERE user_id = $1 AND NOT done AND created_at < $2::date", [userId, old]),
  ]);
  return [
    ...notes.map((n): MemoryItem => ({ kind: "trecho", id: n.id, title: `“${clip(n.quote, 220)}”`, detail: n.title, href: `/leituras/${n.item_id}` })),
    ...recipes.map((r): MemoryItem => ({ kind: "receita", id: r.id, title: r.title, detail: "Faz tempo que não entra no cardápio", href: `/receitas/${r.id}` })),
    ...albums.map((a): MemoryItem => ({ kind: "album", id: a.id, title: a.title, detail: a.creator, href: "/musica" })),
    ...wishes.map((w): MemoryItem => ({ kind: "desejo", id: w.id, title: w.name, detail: null, href: "/desejos" })),
    ...ideas.map((i): MemoryItem => ({ kind: "ideia", id: i.id, title: clip(i.text, 200), detail: null, href: "/ideias" })),
  ];
}

/** O card de hoje: o item já mostrado hoje (estável ao recarregar), um novo sorteado, ou nada ("agora não" esconde pelo resto do dia). */
export async function memoryForToday(userId: string, today: string): Promise<MemoryItem | null> {
  const rows = await query<{ kind: MemoryKind; item_id: string; state: string }>("SELECT kind, item_id, state FROM memory_shown WHERE user_id = $1 AND shown_on = $2::date ORDER BY created_at", [userId, today]);
  if (rows.some((r) => r.state === "hidden")) return null;
  const all = await candidates(userId, today);
  const current = [...rows].reverse().find((r) => r.state === "shown");
  if (current) { const hit = all.find((c) => c.kind === current.kind && c.id === current.item_id); if (hit) return hit; }
  return drawMemory(userId, today, all);
}

async function drawMemory(userId: string, today: string, all: MemoryItem[]): Promise<MemoryItem | null> {
  const recent = await query<{ kind: string; item_id: string }>("SELECT kind, item_id FROM memory_shown WHERE user_id = $1 AND shown_on > $2::date", [userId, addDays(today, -MEMORY_COOLDOWN_DAYS)]);
  const seen = new Set(recent.map((r) => `${r.kind}:${r.item_id}`));
  const pick = pickMemory(all, seen);
  if (!pick) return null;
  await query("INSERT INTO memory_shown (user_id, kind, item_id, shown_on, state) VALUES ($1,$2,$3,$4::date,'shown') ON CONFLICT (user_id, kind, item_id, shown_on) DO UPDATE SET state = 'shown'", [userId, pick.kind, pick.id, today]);
  return pick;
}

/** "Outra": guarda o atual como trocado e sorteia um diferente (que não tenha saído nos últimos dias). */
export async function swapMemory(userId: string, today: string): Promise<void> {
  await query("UPDATE memory_shown SET state = 'swapped' WHERE user_id = $1 AND shown_on = $2::date AND state = 'shown'", [userId, today]);
  await drawMemory(userId, today, await candidates(userId, today));
}

/** "Agora não": o card some até amanhã e esse item não volta pelo período de espera. */
export async function hideMemory(userId: string, today: string): Promise<void> {
  const cur = await queryOne<{ kind: string; item_id: string }>("SELECT kind, item_id FROM memory_shown WHERE user_id = $1 AND shown_on = $2::date AND state = 'shown' ORDER BY created_at DESC LIMIT 1", [userId, today]);
  if (cur) await query("UPDATE memory_shown SET state = 'hidden' WHERE user_id = $1 AND shown_on = $2::date AND kind = $3 AND item_id = $4", [userId, today, cur.kind, cur.item_id]);
  else await query("INSERT INTO memory_shown (user_id, kind, item_id, shown_on, state) VALUES ($1,'ideia','00000000-0000-0000-0000-000000000000',$2::date,'hidden') ON CONFLICT DO NOTHING", [userId, today]);
}
