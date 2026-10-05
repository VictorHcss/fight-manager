"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { handleForm, safeBack, withFlash, type ActionState } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { DomainError } from "@/lib/errors";
import { entryInput } from "@/lib/validation";
import { cancelEntry, createEntry } from "@/services/finance";

export async function createEntryAction(_: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireAcademyAdmin("financeiro");
  let done = false;
  const state = await handleForm(form, entryInput, async (data) => { await createEntry(ctx, data); done = true; });
  if (!done) return state;
  revalidatePath("/", "layout");
  redirect("/financeiro?ok=lancamento-criado");
}

export async function cancelEntryAction(form: FormData) {
  const ctx = await requireAcademyAdmin("financeiro");
  const back = safeBack(form.get("back"), "/financeiro");
  try {
    await cancelEntry(ctx, String(form.get("id")));
  } catch (error) {
    if (error instanceof DomainError) redirect(`${back.split("?")[0]}?erro=${encodeURIComponent(error.message)}`);
    throw error;
  }
  revalidatePath("/", "layout");
  redirect(withFlash(back, "lancamento-cancelado"));
}
