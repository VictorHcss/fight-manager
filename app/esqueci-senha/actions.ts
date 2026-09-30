"use server";

import { clientIp, siteUrl } from "@/lib/url";
import { requestPasswordReset } from "@/services/password-reset";

export async function requestResetAction(_: { sent?: boolean; message?: string }, form: FormData): Promise<{ sent?: boolean; message?: string }> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { message: "Informe um e-mail válido." };
  await requestPasswordReset(email, await siteUrl(), await clientIp());
  return { sent: true }; // mesma resposta exista a conta ou não
}
