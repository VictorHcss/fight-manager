"use server";

import { revalidatePath } from "next/cache";
import { handleForm, type ActionState } from "@/lib/action";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { siteUrl } from "@/lib/url";
import { platformAcademyInput } from "@/lib/validation";
import { createAcademyWithAdmin, resendAdminAccess } from "@/services/accounts";
import { setAcademyActive } from "@/services/users";
import { redirect } from "next/navigation";
import { isUuid } from "@/lib/page";

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

/** Suspender ou reativar: confirmado numa janela antes de enviar. */
export async function toggleAcademyAction(form: FormData) {
  const ctx = await requirePlatformAdmin();
  const id = String(form.get("academyId"));
  const active = form.get("active") === "true";
  if (!isUuid(id)) redirect("/plataforma");
  await setAcademyActive(ctx, id, active);
  revalidatePath("/plataforma");
  redirect(`/plataforma?ok=${active ? "academia-reativada" : "academia-suspensa"}`);
}
