import { notFound, redirect } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { ensureCategories } from "@/lib/finance";
import { localDateKey } from "@/lib/time";
import { loadTrilha } from "@/lib/trilha";
import { shortcutByKey } from "@/lib/shortcuts";
import { PageHeader } from "@/components/PageHeader";
import { ExpenseScreen, HabitsScreen, IdeaScreen, LinkScreen, MoodScreen, SleepScreen, WaterScreen, WorkoutScreen } from "@/components/quick/QuickScreens";

export const metadata = { title: "Registro rápido" };

/** Telas de um toque dos atalhos do ícone (/quick/gasto, /quick/agua...). Só os campos mínimos, e volta para Hoje ao salvar. */
export default async function QuickPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const today = localDateKey();

  // atalhos que só levam a outro lugar
  if (slug === "continuar-leitura") {
    const item = await queryOne<{ id: string }>("SELECT id FROM reading_items WHERE user_id = $1 AND status = 'lendo' ORDER BY created_at DESC LIMIT 1", [user.id]);
    redirect(item ? `/leituras/${item.id}` : "/leituras");
  }
  if (slug === "trilha") {
    const { trilha } = await loadTrilha(user.id, today, true);
    // a playlist abre no app de música; sem playlist, vai para a tela de Música
    redirect(trilha?.url && /^https:\/\//.test(trilha.url) ? trilha.url : "/musica");
  }

  const sc = shortcutByKey(slug === "gasto" ? "gasto" : slug === "agua" ? "agua" : slug === "humor" ? "humor" : slug === "ideia" ? "ideia" : slug === "ler-depois" ? "ler-depois" : slug === "sono" ? "sono" : slug === "exercicio" ? "exercicio" : slug === "habitos" ? "habitos" : "");
  if (!sc) notFound();
  const title = sc.name;
  let body: React.ReactNode = null;
  switch (slug) {
    case "gasto": body = <ExpenseScreen categories={(await ensureCategories(user.id)).map((c) => ({ id: c.id, name: c.name }))} />; break;
    case "agua": {
      const [w, s] = await Promise.all([queryOne<{ glasses: number }>("SELECT glasses FROM water_logs WHERE user_id = $1 AND date = $2::date", [user.id, today]), getSettings(user.id)]);
      body = <WaterScreen glasses={w?.glasses ?? 0} goal={s.waterGoal} />; break;
    }
    case "humor": body = <MoodScreen />; break;
    case "ideia": body = <IdeaScreen />; break;
    case "ler-depois": body = <LinkScreen />; break;
    case "sono": { const s = await getSettings(user.id); body = <SleepScreen slept={s.sleep} woke={s.wake} />; break; }
    case "exercicio": body = <WorkoutScreen />; break;
    case "habitos": {
      const habits = await query<{ id: string; name: string }>("SELECT h.id, h.name FROM habits h WHERE h.user_id = $1 AND NOT h.archived AND NOT EXISTS (SELECT 1 FROM habit_logs l WHERE l.habit_id = h.id AND l.date = $2::date) ORDER BY h.created_at", [user.id, today]);
      body = <HabitsScreen habits={habits} />; break;
    }
  }
  return (<><PageHeader title={title} back="/" />{body}</>);
}
