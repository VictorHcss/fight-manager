"use server";

import { revalidatePath } from "next/cache";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { isValidDate, todayIn } from "@/lib/dates";
import { isUuid } from "@/lib/page";
import { setPresence } from "@/services/attendance";

/** Marca ou desmarca a presença. Não aceita data no futuro. */
export async function togglePresenceAction(form: FormData) {
  const ctx = await requireAcademyAdmin("presenca");
  const studentId = String(form.get("studentId") ?? "");
  const raw = String(form.get("date") ?? "");
  const today = todayIn(ctx.timezone);
  const date = isValidDate(raw) && raw <= today ? raw : today;
  if (!isUuid(studentId)) return;
  await setPresence(ctx, studentId, date, form.get("present") === "true");
  revalidatePath("/presenca");
}
