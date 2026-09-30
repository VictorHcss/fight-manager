"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, safeBack, withFlash, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { isValidReference, monthRange } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { feeInput, feeUpdateInput } from "@/lib/validation";
import { cancelFee, createFee, generateMonthlyFees, updateFee } from "@/services/fees";

export async function createFeeAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let studentId = "";
  const state = await handleForm(form, feeInput, async (data) => { studentId = (await createFee(ctx, data)).studentId; });
  if (!studentId) return state;
  revalidatePath("/mensalidades");
  redirect(`/alunos/${studentId}?aba=mensalidades&ok=mensalidade-criada`);
}

export async function updateFeeAction(id: string, _: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  let saved = false;
  const state = await handleForm(form, feeUpdateInput, async (data) => { await updateFee(ctx, id, data); saved = true; });
  if (!saved) return state;
  revalidatePath("/mensalidades");
  redirect(withFlash(safeBack(form.get("back"), "/mensalidades"), "mensalidade-salva"));
}

export async function cancelFeeAction(form: FormData) {
  const ctx = await requireAcademyAdmin();
  const back = safeBack(form.get("back"), "/mensalidades");
  try {
    await cancelFee(ctx, String(form.get("id")));
  } catch (error) {
    if (error instanceof DomainError) redirect(`${back.split("?")[0]}?erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/mensalidades");
  redirect(withFlash(back, "mensalidade-cancelada"));
}

export async function generateFeesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin();
  const reference = String(form.get("reference") ?? "");
  if (!isValidReference(reference)) return { message: "Escolha um mês válido.", errors: { reference: "Mês inválido." }, values: { reference } };
  const result = await generateMonthlyFees(ctx, reference);
  revalidatePath("/mensalidades");
  const { from, to } = monthRange(reference);
  redirect(`/mensalidades?de=${from}&ate=${to}&ok=mensalidades-geradas&geradas=${result.created}`);
}
