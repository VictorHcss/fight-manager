import type { Metadata } from "next";
import Link from "next/link";
import { Submit } from "@/components/client";
import { AuthLayout } from "@/components/AuthLayout";
import { currentUser } from "@/lib/auth/session";
import { consentText } from "@/lib/consent";
import { resolveInvite } from "@/services/invites";
import { logout } from "../../login/actions";
import { joinAction, signupAction } from "./actions";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Convite" };
export const dynamic = "force-dynamic";

/** Página pública aberta pelo QR Code: o token decide a academia, no servidor. */
export default async function InviteLanding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await resolveInvite(token);
  const user = await currentUser();

  if (!invite) {
    return (
      <AuthLayout title="Convite inválido"
        lead="Este código não existe, foi substituído ou expirou. Peça o QR Code atualizado na recepção da academia."
        footer={<>Já tem conta? <Link href="/login">Entrar</Link></>}>
        <Link href="/criar-conta?tipo=aluno" className="btn btn--large">Digitar outro código</Link>
      </AuthLayout>
    );
  }

  if (user?.role === "STUDENT") {
    return (
      <AuthLayout title={`Entrar na ${invite.academyName}`} lead={`Você já tem conta como ${user.name}. Quer pedir para entrar nesta academia?`}
        footer={<>Não é você? <form action={logout} className="inline"><button type="submit" className="link-inline">Sair</button></form></>}>
        <form action={joinAction.bind(null, token)} className="form">
          <label className="check"><input type="checkbox" name="consent" required /> {consentText(invite.academyName)}</label>
          <Submit pending="Enviando…" className="btn btn--primary btn--large">Pedir para entrar</Submit>
        </form>
      </AuthLayout>
    );
  }

  if (user) {
    return (
      <AuthLayout title={`Convite da ${invite.academyName}`}
        lead="Você está conectado como administrador. Para testar o convite, saia da conta ou abra o link em uma janela anônima.">
        <form action={logout}><button type="submit" className="btn btn--large">Sair e continuar</button></form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={`Entrar na ${invite.academyName}`} wide
      lead="Crie sua conta. A recepção vai aprovar sua entrada e você passa a ver suas mensalidades e pagamentos."
      footer={<>Já tem conta? <Link href={`/login?proximo=/convite/${token}`}>Entrar</Link></>}>
      <SignupForm action={signupAction.bind(null, token)} academy={invite.academyName} />
    </AuthLayout>
  );
}
