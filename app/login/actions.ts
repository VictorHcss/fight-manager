"use server";

import { redirect } from "next/navigation";
import { checkCredentials } from "@/lib/auth/login";
import { safeBack } from "@/lib/action";
import { createSession, destroySession } from "@/lib/auth/session";

export async function login(_: { message?: string; email?: string }, form: FormData): Promise<{ message?: string; email?: string }> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { message: "Informe e-mail e senha.", email };
  const result = await checkCredentials(email, password);
  if (!result.ok) return { message: result.message, email }; // devolve o e-mail: o React limpa o formulário após o envio
  await createSession(result.userId);
  const home = result.role === "PLATFORM_ADMIN" ? "/plataforma" : result.role === "STUDENT" ? "/aluno" : "/";
  redirect(form.get("next") ? safeBack(form.get("next"), home) : home);
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
