"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { handleForm, type ActionState } from "@/lib/action";
import { siteUrl } from "@/lib/url";
import { addByEmailInput } from "@/lib/validation";
import { regenerateInvite, sendInviteEmail } from "@/services/invites";

export type EmailInviteState = ActionState & { sent?: string };

export async function regenerateInviteAction() {
  const ctx = await requireAcademyAdmin("solicitacoes");
  await regenerateInvite(ctx);
  revalidatePath("/convidar");
  redirect("/convidar?ok=convite-novo");
}

export async function emailInviteAction(_: EmailInviteState, form: FormData): Promise<EmailInviteState> {
  const ctx = await requireAcademyAdmin("solicitacoes");
  let done = false;
  const state = await handleForm(form, addByEmailInput, async (data) => { await sendInviteEmail(ctx, data.email, await siteUrl()); done = true; });
  return done ? { sent: String(form.get("email")).trim().toLowerCase() } : state;
}
