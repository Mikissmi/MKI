"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { parseShared, saveShared, SHARE_DESTS, type ShareDest } from "@/lib/share";

/** Guarda o que foi compartilhado no destino escolhido e mostra a confirmação. */
export async function shareTo(f: FormData) {
  const u = await requireUser();
  const dest = String(f.get("dest") ?? "") as ShareDest;
  if (!SHARE_DESTS.some((d) => d.key === dest)) redirect("/");
  const shared = parseShared({ title: String(f.get("title") ?? ""), text: String(f.get("text") ?? ""), url: String(f.get("url") ?? "") });
  const r = await saveShared(u.id, dest, shared);
  revalidatePath("/", "layout");
  const q = new URLSearchParams(r.ok ? { saved: dest, ...(r.duplicate ? { dup: "1" } : {}) } : { error: r.error });
  redirect(`/compartilhar?${q}`);
}
