"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { addByEmailInput, approvalInput } from "@/lib/validation";
import { addStudentByEmail, approveByLinking, approveRequest, rejectRequest } from "@/services/enrollment";

export async function approveAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("solicitacoes");
  let done = false;
  const state = await handleForm(form, approvalInput, async (data) => { await approveRequest(ctx, id, data); done = true; });
  if (!done) return state;
  revalidatePath("/", "layout");
  redirect(`/alunos/${id}?ok=entrada-aprovada`);
}

async function decide(run: () => Promise<unknown>, ok: string, target: (() => string) | null = null) {
  try {
    await run();
  } catch (error) {
    if (error instanceof DomainError) redirect(`/solicitacoes?erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(target ? `${target()}?ok=${ok}` : `/solicitacoes?ok=${ok}`);
}

export async function linkAction(form: FormData) {
  const ctx = await requireAcademyAdmin("solicitacoes");
  const existing = String(form.get("existing"));
  await decide(() => approveByLinking(ctx, String(form.get("id")), existing), "entrada-vinculada", () => `/alunos/${existing}`);
}

export async function rejectAction(form: FormData) {
  const ctx = await requireAcademyAdmin("solicitacoes");
  const reason = String(form.get("reason") ?? "").trim().slice(0, 200) || null;
  await decide(() => rejectRequest(ctx, String(form.get("id")), reason), "entrada-recusada");
}

/** Adiciona um aluno que já tem conta (sem academia ou de outra academia), pelo e-mail da conta. */
export async function addByEmailAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("solicitacoes");
  let studentId = "";
  const state = await handleForm(form, addByEmailInput, async (data) => { studentId = (await addStudentByEmail(ctx, data.email)).studentId; });
  if (!studentId) return state;
  revalidatePath("/", "layout");
  redirect(`/solicitacoes?ok=aluno-adicionado#pedido-${studentId}`);
}
