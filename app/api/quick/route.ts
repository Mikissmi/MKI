import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { applyQuick, quickSchema } from "@/lib/quick";

/** Registro rápido (botão +). Também recebe os registros guardados offline quando a conexão volta. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
  const parsed = quickSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "pedido inválido" }, { status: 400 });
  const r = await applyQuick(user.id, parsed.data);
  if (r.ok) revalidatePath("/", "layout");
  return NextResponse.json(r, { status: r.ok ? 200 : 422 });
}
