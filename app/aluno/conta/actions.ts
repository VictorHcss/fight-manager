"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireStudent } from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import { ownContactInput, passwordChangeInput } from "@/lib/validation";
import { updateOwnPhone } from "@/services/student-portal";
import { changePassword } from "@/services/users";
import { sendEmailVerification } from "@/services/email-verification";
import { siteUrl } from "@/lib/url";

export async function updateContactAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireStudent();
  let ok = false;
  const state = await handleForm(form, ownContactInput, async (data) => { await updateOwnPhone(ctx, data.phone); ok = true; });
  if (!ok) return state;
  revalidatePath("/aluno");
  redirect("/aluno/conta?ok=contato-salvo");
}

export async function studentPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireStudent();
  let ok = false;
  const state = await handleForm(form, passwordChangeInput, async (data) => { await changePassword(ctx.userId, null, data.current, data.next); ok = true; });
  if (!ok) return { ...state, values: {} }; // nunca devolve senhas para o navegador
  await createSession(ctx.userId); // as outras sessões foram encerradas; esta continua
  redirect("/aluno/conta?ok=senha-alterada");
}

/** Reenvia o link de confirmação de e-mail (com limite de envios por hora). */
export async function resendVerificationAction() {
  const ctx = await requireStudent();
  await sendEmailVerification(ctx.userId, await siteUrl());
  redirect("/aluno?ok=email-reenviado");
}
