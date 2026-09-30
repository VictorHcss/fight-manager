"use server";

import { revalidatePath } from "next/cache";
import { handleForm, type ActionState } from "@/lib/action";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { siteUrl } from "@/lib/url";
import { platformAcademyInput } from "@/lib/validation";
import { createAcademyWithAdmin, resendAdminAccess } from "@/services/accounts";

/** Resultado mostrado depois de criar a academia ou gerar um novo link: o link fica visível uma vez, para copiar. */
export type AccessState = ActionState & { created?: { academy: string; email: string; link: string; sent: boolean } };

export async function createAcademyAction(_: AccessState, form: FormData): Promise<AccessState> {
  const ctx = await requirePlatformAdmin();
  let created: AccessState["created"];
  const state = await handleForm(form, platformAcademyInput, async (data) => {
    const r = await createAcademyWithAdmin(ctx, data, await siteUrl());
    created = { academy: data.academyName, email: data.adminEmail, link: r.link, sent: r.sent };
  });
  if (!created) return state;
  revalidatePath("/plataforma");
  return { created };
}

export async function resendAccessAction(_: AccessState, form: FormData): Promise<AccessState> {
  const ctx = await requirePlatformAdmin();
  try {
    const r = await resendAdminAccess(ctx, String(form.get("academyId")), await siteUrl());
    return { created: { academy: String(form.get("academyName")), email: r.email, link: r.link, sent: r.sent } };
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message };
    throw error;
  }
}
