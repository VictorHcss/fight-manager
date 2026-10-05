"use server";

import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireStudent } from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import { siteUrl } from "@/lib/url";
import { sendEmailVerification } from "@/services/email-verification";
import { DomainError } from "@/lib/errors";
import { allow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/url";
import { signupInput } from "@/lib/validation";
import { joinWithInvite, signUpWithInvite } from "@/services/enrollment";

export async function signupAction(token: string, _: ActionState, form: FormData): Promise<ActionState> {
  // o QR fica exposto na recepção: limite de cadastros por conexão contra spam na fila
  if (!allow(`signup:${await clientIp()}`, 10, 60 * 60_000)) return { message: "Muitos cadastros a partir desta conexão. Tente de novo mais tarde." };
  let userId = "";
  const state = await handleForm(form, signupInput, async (data) => { userId = (await signUpWithInvite(token, data)).userId; });
  if (!userId) return { ...state, values: { ...state.values, password: "", confirm: "" } }; // nunca devolve a senha
  await createSession(userId);
  await sendEmailVerification(userId, await siteUrl()); // o envio nunca derruba o cadastro (sendSafely)
  redirect("/aluno?ok=pedido-enviado");
}

export async function joinAction(token: string, form: FormData) {
  const ctx = await requireStudent();
  try {
    await joinWithInvite(ctx.userId, token, form.get("consent") === "on");
  } catch (error) {
    if (error instanceof DomainError) redirect(`/aluno?erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect("/aluno?ok=pedido-enviado");
}
