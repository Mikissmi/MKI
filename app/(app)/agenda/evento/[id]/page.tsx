import { notFound } from "next/navigation";
import { z } from "zod";
import { Button } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { fetchEvent } from "@/lib/agenda/queries";
import { fmtMin } from "@/lib/time";
import { PageHeader } from "@/components/PageHeader";
import { EventForm } from "@/components/agenda/EventForm";
import { deleteEvent } from "../../actions";

export const metadata = { title: "Evento" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const ev = await fetchEvent(user.id, id.data);
  if (!ev) notFound();
  return (
    <>
      <PageHeader title="Editar evento" />
      <EventForm defaults={{
        id: ev.id, title: ev.title, date: ev.date, time: fmtMin(ev.startMin), duration: ev.durationMin, location: ev.location ?? "",
        category: ev.category, recurrence: ev.recurrence, until: ev.recurrenceUntil ?? "", remind: ev.remindMinutes === null ? "" : String(ev.remindMinutes), notes: ev.notes ?? "",
      }} />
      <form action={deleteEvent}>
        <input type="hidden" name="id" value={ev.id} />
        <Button type="submit" color="red" variant="subtle" fullWidth mt="md">Excluir evento{ev.recurrence !== "none" ? " (e todas as repetições)" : ""}</Button>
      </form>
    </>
  );
}
