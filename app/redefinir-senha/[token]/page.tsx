import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { checkResetToken } from "@/services/password-reset";
import { ResetForm } from "./ResetForm";

export const metadata: Metadata = { title: "Nova senha", referrer: "no-referrer" }; // o token não vaza para outros sites
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await checkResetToken(token);
  const footer = <>Voltar para o <Link href="/login">login</Link><span className="auth-footer-sep" aria-hidden="true" /> Não tem conta? <Link href="/criar-conta">Criar conta</Link></>;
  return valid ? (
    <AuthLayout title="Criar nova senha" footer={footer}
      lead="Depois de salvar, você entra com a nova senha. Outros aparelhos conectados serão desconectados.">
      <ResetForm token={token} />
    </AuthLayout>
  ) : (
    <AuthLayout title="Link expirado" footer={footer}
      lead="Este link expirou, já foi usado ou não existe. Os links valem por 30 minutos e só funcionam uma vez.">
      <Link href="/esqueci-senha" className="btn btn--primary btn--large">Pedir um novo link</Link>
    </AuthLayout>
  );
}
