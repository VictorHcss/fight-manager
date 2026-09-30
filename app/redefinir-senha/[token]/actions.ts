"use server";

import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { resetPassword } from "@/services/password-reset";

export type ResetState = { message?: string; errors?: Record<string, string> };

export async function resetAction(token: string, _: ResetState, form: FormData): Promise<ResetState> {
  const next = String(form.get("next") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (next.length < 10) return { errors: { next: "A nova senha precisa ter pelo menos 10 caracteres." } };
  if (next !== confirm) return { errors: { confirm: "As senhas não conferem." } };
  try {
    await resetPassword(token, next);
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message };
    throw error;
  }
  redirect("/login?ok=senha-redefinida");
}
