"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { academyInput, modalityInput, passwordChangeInput, userInput } from "@/lib/validation";
import { createModality, setModalityActive, updateAcademy, updateModality, updateTerms } from "@/services/academy";
import { createSession } from "@/lib/auth/session";
import { changePassword, createAcademyAdmin, setUserActive } from "@/services/users";

const done = (aba: string, ok: string) => {
  revalidatePath("/", "layout");
  redirect(`/configuracoes?aba=${aba}&ok=${ok}`);
};

export async function createUserAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let ok = false;
  const state = await handleForm(form, userInput, async (data) => { await createAcademyAdmin(ctx, data); ok = true; });
  if (!ok) return { ...state, values: { ...state.values, password: "" } };
  done("acesso", "usuario-criado");
  return {};
}

export async function toggleUserAction(form: FormData) {
  const ctx = await requireAcademyAdmin();
  try {
    await setUserActive(ctx, String(form.get("id")), form.get("active") === "true");
  } catch (error) {
    if (error instanceof DomainError) redirect(`/configuracoes?aba=acesso&erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  done("acesso", "usuario-salvo");
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let ok = false;
  const state = await handleForm(form, passwordChangeInput, async (data) => { await changePassword(ctx.userId, ctx.academyId, data.current, data.next); ok = true; });
  if (!ok) return { ...state, values: {} }; // nunca devolve senhas para o navegador
  await createSession(ctx.userId); // as outras sessões foram encerradas; esta continua aberta
  done("acesso", "senha-alterada");
  return {};
}

export async function updateAcademyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let ok = false;
  const state = await handleForm(form, academyInput, async (data) => { await updateAcademy(ctx, data); ok = true; });
  if (!ok) return state;
  done("academia", "academia-salva");
  return {};
}

export async function updateTermsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  await updateTerms(ctx, String(form.get("terms") ?? ""));
  done("ficha", "termos-salvos");
  return {};
}

export async function saveModalityAction(id: string | null, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let ok = false;
  const state = await handleForm(form, modalityInput, async (data) => { if (id) await updateModality(ctx, id, data); else await createModality(ctx, data); ok = true; });
  if (!ok) return state;
  done("modalidades", "modalidade-salva");
  return {};
}

export async function toggleModalityAction(form: FormData) {
  const ctx = await requireAcademyAdmin();
  await setModalityActive(ctx, String(form.get("id")), form.get("active") === "true");
  done("modalidades", "modalidade-salva");
}
