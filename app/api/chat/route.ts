import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { handleChat } from "@/lib/planner/service";

const body = z.object({ message: z.string().trim().min(1).max(600) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "mensagem inválida" }, { status: 400 });
  return NextResponse.json(await handleChat(user.id, parsed.data.message));
}
