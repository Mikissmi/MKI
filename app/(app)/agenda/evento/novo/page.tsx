import { requireUser } from "@/lib/auth/session";
import { isDateKey, localDateKey } from "@/lib/time";
import { PageHeader } from "@/components/PageHeader";
import { EventForm } from "@/components/agenda/EventForm";

export const metadata = { title: "Novo evento" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireUser();
  const { d } = await searchParams;
  return (
    <>
      <PageHeader title="Novo evento" />
      <EventForm defaults={{ title: "", date: isDateKey(d) ? d : localDateKey(), time: "10:00", duration: 60, location: "", category: "pessoal", recurrence: "none", until: "", remind: "", notes: "" }} />
    </>
  );
}
