import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { ResetRequestForm } from "./ResetRequestForm";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout title="Esqueci minha senha"
      lead="Informe o e-mail da sua conta. Vamos enviar um link para você criar uma nova senha."
      footer={<>Lembrou a senha? <Link href="/login">Entrar</Link><span className="auth-footer-sep" aria-hidden="true" /> Não tem conta? <Link href="/criar-conta">Criar conta</Link></>}>
      <ResetRequestForm />
    </AuthLayout>
  );
}
