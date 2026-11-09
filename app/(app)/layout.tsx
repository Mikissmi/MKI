import { redirect } from "next/navigation";
import { Container } from "@mantine/core";
import { getSessionUser } from "@/lib/auth/session";
import { BottomNav } from "@/components/BottomNav";
import { ReminderWatcher } from "@/components/agenda/ReminderWatcher";
import { QuickAddButton } from "@/components/QuickAddButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Segunda barreira, além do proxy.
  if (!(await getSessionUser())) redirect("/login");
  return (
    <>
      <Container size="sm" pt="md" pb="calc(var(--mki-nav-height) + 96px)">
        {children}
      </Container>
      <ReminderWatcher />
      <QuickAddButton />
      <BottomNav />
    </>
  );
}
