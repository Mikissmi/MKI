import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { getArticleText } from "@/lib/article";
import { ensureTextSummary, loadNews } from "@/lib/news-read";

/** Texto da matéria em modo leitura, buscado na hora (só em cache temporário na memória, nunca no banco). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const id = z.string().uuid().safeParse((await ctx.params).id);
  if (!id.success) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const n = await loadNews(user.id, id.data);
  if (!n) return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  const art = await getArticleText(n.link);
  const summary = art.ok ? await ensureTextSummary(user.id, n) : n.summary;
  return NextResponse.json({ ok: art.ok, paywall: art.paywall, error: art.error ?? null, paragraphs: art.ok ? art.paragraphs : [], summary }, { headers: { "Cache-Control": "private, no-store" } });
}
