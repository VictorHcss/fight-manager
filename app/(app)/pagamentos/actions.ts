"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, safeBack, withFlash, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { paymentInput } from "@/lib/validation";
import { cancelPayment, confirmPayment, createPayment } from "@/services/payments";

export async function createPaymentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("pagamentos");
  let studentId = "";
  const state = await handleForm(form, paymentInput, async (data) => { studentId = (await createPayment(ctx, data)).studentId; });
  if (!studentId) return state;
  revalidatePath("/", "layout");
  redirect(`/alunos/${studentId}?aba=pagamentos&ok=pagamento-registrado`);
}

async function simple(form: FormData, run: (id: string) => Promise<unknown>, ok: string) {
  const back = safeBack(form.get("back"), "/pagamentos");
  try {
    await run(String(form.get("id")));
  } catch (error) {
    if (error instanceof DomainError) redirect(`${back.split("?")[0]}?erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(withFlash(back, ok));
}

export async function cancelPaymentAction(form: FormData) {
  const ctx = await requireAcademyAdmin("pagamentos");
  await simple(form, (id) => cancelPayment(ctx, id, String(form.get("reason") ?? "")), "pagamento-cancelado");
}

export async function confirmPaymentAction(form: FormData) {
  const ctx = await requireAcademyAdmin("pagamentos");
  await simple(form, (id) => confirmPayment(ctx, id), "pagamento-confirmado");
}
