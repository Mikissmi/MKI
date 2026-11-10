import { after } from "next/server";
import { redirect } from "next/navigation";
import { Container } from "@mantine/core";
import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { ensureCategories } from "@/lib/finance";
import { accentCss } from "@/lib/accent";
import { localDateKey } from "@/lib/time";
import { recordOpen } from "@/lib/presence";
import { BottomNav } from "@/components/BottomNav";
import { QuickAdd } from "@/components/QuickAdd";
import { OfflineSync } from "@/components/OfflineSync";
import { ReminderWatcher } from "@/components/agenda/ReminderWatcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Segunda barreira, além do proxy.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [settings, categories, habits] = await Promise.all([
    getSettings(user.id), ensureCategories(user.id),
    query<{ id: string; name: string }>("SELECT h.id, h.name FROM habits h WHERE h.user_id = $1 AND NOT h.archived AND NOT EXISTS (SELECT 1 FROM habit_logs l WHERE l.habit_id = h.id AND l.date = $2::date) ORDER BY h.created_at", [user.id, localDateKey()]),
  ]);
  // registra a abertura de hoje depois de responder (no máximo uma escrita por dia)
  after(() => recordOpen(user.id, settings));
  const css = accentCss(settings.accent);
  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <OfflineSync />
      <Container id="conteudo" component="main" size="sm" pt="md" pb="calc(var(--mki-nav-height) + 96px)">{children}</Container>
      <QuickAdd categories={categories.map((c) => ({ id: c.id, name: c.name }))} habits={habits} />
      <ReminderWatcher />
      <BottomNav />
    </>
  );
}
