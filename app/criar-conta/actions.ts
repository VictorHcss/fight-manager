"use server";

import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { createSession } from "@/lib/auth/session";
import { allow } from "@/lib/rate-limit";
import { clientIp } from "@/lib/url";
import { inviteTokenFrom, studentAccountInput } from "@/lib/validation";
import { signUpStudent } from "@/services/accounts";
import { resolveInvite } from "@/services/invites";

/** Conta de aluno sem convite: nasce sem academia. */
export async function studentSignupAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!allow(`account-signup:${await clientIp()}`, 10, 60 * 60_000)) return { message: "Muitos cadastros a partir desta conexão. Tente de novo mais tarde." };
  let userId = "";
  const state = await handleForm(form, studentAccountInput, async (data) => { userId = (await signUpStudent(data)).userId; });
  if (!userId) return { ...state, values: { ...state.values, password: "", confirm: "" } }; // nunca devolve a senha
  await createSession(userId);
  redirect("/aluno?ok=conta-criada");
}

/** Aluno com o código (ou o link) do convite: confere e leva para a página do convite. */
export async function inviteCodeAction(_: ActionState, form: FormData): Promise<ActionState> {
  const raw = String(form.get("code") ?? "");
  if (!allow(`invite-code:${await clientIp()}`, 30, 15 * 60_000)) return { message: "Muitas tentativas. Aguarde alguns minutos.", values: { code: raw } };
  const token = inviteTokenFrom(raw);
  if (!token || !(await resolveInvite(token))) {
    return { errors: { code: "Código não encontrado ou expirado. Confira com a recepção da academia." }, values: { code: raw } };
  }
  redirect(`/convite/${token}`);
}
