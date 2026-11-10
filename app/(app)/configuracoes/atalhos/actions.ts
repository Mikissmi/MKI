"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { patchSettings } from "@/lib/settings";
import { CUSTOM_MAX, KITS, SHORTCUTS } from "@/lib/shortcuts";
import type { FormState } from "@/lib/agenda/schemas";

export async function saveShortcuts(_p: FormState, f: FormData): Promise<FormState> {
  const u = await requireUser();
  const kit = String(f.get("kit") ?? "");
  if (kit !== "custom" && !KITS.some((k) => k.key === kit)) return { error: "Escolha um kit." };
  const known = new Set(SHORTCUTS.map((s) => s.key));
  const picked = f.getAll("custom").map(String).filter((k) => known.has(k));
  const custom = [...new Set(picked)];
  if (kit === "custom" && custom.length === 0) return { error: "Escolha pelo menos um atalho." };
  if (custom.length > CUSTOM_MAX) return { error: `Escolha no máximo ${CUSTOM_MAX} atalhos.` };
  await patchSettings(u.id, { shortcutKit: kit, ...(custom.length ? { shortcutCustom: custom } : {}) });
  revalidatePath("/configuracoes/atalhos");
  return { ok: true };
}
