import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { currentUser } from "@/lib/auth/session";
import { showTestAccounts, TEST_PASSWORD } from "@/lib/test-accounts";
import { existingTestAccounts } from "@/services/users";
import { LoginForm } from "./LoginForm";
import { TestAccounts } from "./TestAccounts";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string; proximo?: string; ok?: string }> }) {
  const user = await currentUser();
  if (user) redirect(user.role === "PLATFORM_ADMIN" ? "/plataforma" : user.role === "STUDENT" ? "/aluno" : "/");
  const { erro, proximo, ok } = await searchParams;
  const next = proximo?.startsWith("/convite/") ? proximo : undefined;
  const accounts = showTestAccounts() ? await existingTestAccounts() : [];
  return (
    <AuthLayout
      title="Entrar"
      lead={next ? "Entre com a sua conta para usar o convite da academia." : "Bom te ver de novo. Entre com o e-mail e a senha da sua conta."}
      footer={<>Ainda não tem conta? <Link href={next ? `/criar-conta?proximo=${encodeURIComponent(next)}` : "/criar-conta"}>Criar conta</Link></>}
    >
      {ok === "senha-redefinida" && <div className="alert alert--ok" role="status">Senha redefinida. Entre com a nova senha.</div>}
      <LoginForm next={next} notice={erro === "sem-acesso" ? "Esta conta não tem acesso ao painel da academia." : undefined} />
      {accounts.length > 0 && <TestAccounts accounts={accounts} password={TEST_PASSWORD} />}
    </AuthLayout>
  );
}
