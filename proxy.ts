import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, userFromToken } from "@/lib/auth/session";

/**
 * Protege todas as rotas: sem sessão válida, vai para /login (páginas) ou 401 (API).
 * Rotas de mutação também conferem a origem da requisição.
 */
const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js", "/offline.html"];
const PUBLIC_PREFIXES = ["/icons/", "/brand/", "/_next/"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) || pathname === "/favicon.ico";
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);

  if (isMutation && pathname.startsWith("/api/") && !sameOrigin(req)) {
    return NextResponse.json({ error: "origem inválida" }, { status: 403 });
  }

  if (isPublic(pathname)) return NextResponse.next();

  const user = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
