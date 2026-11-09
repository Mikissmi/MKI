"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { queryOne } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { clearLoginAttempts, isLoginBlocked, recordFailedLogin } from "@/lib/auth/rate-limit";

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ username: form.get("username"), password: form.get("password") });
  if (!parsed.success) return { error: "Informe usuário e senha." };
  const { username, password } = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${username.toLowerCase()}|${ip}`;

  if (await isLoginBlocked(key)) {
    return { error: "Muitas tentativas. Espere alguns minutos e tente de novo." };
  }

  const user = await queryOne<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE lower(username) = lower($1)",
    [username],
  );

  // Se o usuário não existe, gasta o mesmo tempo de uma verificação real.
  const ok = user ? await verifyPassword(user.password_hash, password) : (await hashPassword(password), false);
  if (!user || !ok) {
    await recordFailedLogin(key);
    return { error: "Usuário ou senha incorretos." };
  }

  await clearLoginAttempts(key);
  await createSession(user.id, h.get("user-agent"));
  redirect("/");
}
