import { query } from "@/lib/db";

export type Category = { id: string; name: string; color: string; icon: string };

const DEFAULT_CATEGORIES = [
  { name: "Casa", color: "pink", icon: "home" }, { name: "Alimentação", color: "sage", icon: "salad" }, { name: "Transporte", color: "sun", icon: "bus" },
  { name: "Lazer", color: "lavender", icon: "music" }, { name: "Saúde", color: "coral", icon: "heart" }, { name: "Outros", color: "sky", icon: "wallet" },
];

/** Categorias do usuário; na primeira vez cria o conjunto padrão (editável depois). */
export async function ensureCategories(userId: string): Promise<Category[]> {
  let rows = await query<Category>("SELECT id, name, color, icon FROM categories WHERE user_id = $1 ORDER BY created_at, name", [userId]);
  if (rows.length === 0) {
    for (const c of DEFAULT_CATEGORIES) {
      await query("INSERT INTO categories (user_id, name, color, icon) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, name) DO NOTHING", [userId, c.name, c.color, c.icon]);
    }
    rows = await query<Category>("SELECT id, name, color, icon FROM categories WHERE user_id = $1 ORDER BY created_at, name", [userId]);
  }
  return rows;
}
