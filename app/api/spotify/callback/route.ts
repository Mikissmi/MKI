import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { getSessionUser } from "@/lib/auth/session";
import { connectAccount } from "@/lib/spotify/auth";
import { spotifyConfig, STATE_COOKIE } from "@/lib/spotify/config";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Volta do Spotify: confere o `state` (contra falsificação), troca o código por tokens e volta para Configurações. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // volta sempre para o endereço registrado no Spotify (o mesmo domínio em que a pessoa está logada)
  const origin = (() => { try { return new URL(spotifyConfig().redirectUri).origin; } catch { return url.origin; } })();
  const back = (r: string, msg?: string) => {
    const to = new URL(`/configuracoes?spotify=${r}`, origin);
    if (msg) to.searchParams.set("msg", msg.slice(0, 200));
    const res = NextResponse.redirect(to, 303);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin), 303);
  if (!spotifyConfig().configured) return back("not_configured");

  const saved = (await cookies()).get(STATE_COOKIE)?.value ?? "";
  const given = url.searchParams.get("state") ?? "";
  if (!saved || !given || !same(saved, given)) return back("state"); // pedido que não veio de nós
  if (url.searchParams.get("error")) return back("denied"); // o usuário recusou no Spotify
  const code = url.searchParams.get("code");
  if (!code) return back("error");
  const r = await connectAccount(user.id, code);
  return r.ok ? back("ok") : back("error", r.error);
}
