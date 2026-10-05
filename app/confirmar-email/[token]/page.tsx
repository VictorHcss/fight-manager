import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert } from "@/components/ui";
import { DomainError } from "@/lib/errors";
import { confirmEmail } from "@/services/email-verification";

export const metadata: Metadata = { title: "Confirmar e-mail" };
export const dynamic = "force-dynamic";

/** Abrir o link já confirma: não há formulário, e abrir de novo depois de confirmado continua mostrando sucesso. */
export default async function ConfirmEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let result: { name: string } | null = null;
  let error = "";
  try {
    result = await confirmEmail(token);
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    error = e.message;
  }
  return (
    <AuthLayout title={result ? "E-mail confirmado" : "Link inválido"}>
      {result
        ? <Alert tone="ok">Pronto, {result.name.split(" ")[0]}! Seu e-mail foi confirmado.</Alert>
        : <Alert tone="danger">{error}</Alert>}
      <Link href="/aluno" className="btn btn--primary btn--large">Ir para minha área</Link>
    </AuthLayout>
  );
}
