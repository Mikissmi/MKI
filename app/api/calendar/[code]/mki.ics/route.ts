import { renderCalendar, userForCode } from "@/lib/calendar-feed";

/** Calendário assinável (.ics). O endereço leva um código secreto; é só de leitura e mostra apenas títulos e horários. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const userId = await userForCode(code);
  if (!userId) return new Response("Não encontrado", { status: 404, headers: { "cache-control": "no-store" } });
  return new Response(await renderCalendar(userId), {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300", "content-disposition": 'inline; filename="mki.ics"', "x-robots-tag": "noindex" },
  });
}
