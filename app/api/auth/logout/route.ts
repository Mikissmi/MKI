import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  await destroySession(all);
  return NextResponse.json({ ok: true });
}
