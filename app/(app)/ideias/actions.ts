"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { removeRecord } from "@/lib/crud";

const done = () => revalidatePath("/", "layout");
export async function addIdea(f: FormData) {
  const u = await requireUser();
  const text = z.string().trim().min(1).max(500).safeParse(f.get("text"));
  if (text.success) await query("INSERT INTO ideas (user_id, text) VALUES ($1,$2)", [u.id, text.data]);
  done();
}
export async function toggleIdea(f: FormData) {
  const u = await requireUser(); const id = z.string().uuid().safeParse(f.get("id")); if (!id.success) return;
  await query("UPDATE ideas SET done = NOT done WHERE id = $1 AND user_id = $2", [id.data, u.id]); done();
}
export async function deleteIdea(f: FormData) { const u = await requireUser(); await removeRecord("ideas", f.get("id"), u.id); }
