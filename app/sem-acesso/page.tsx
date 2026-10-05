import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";
import { Alert } from "@/components/ui";
import { logout } from "../login/actions";

export const metadata: Metadata = { title: "Sem acesso" };

/** Membro da equipe sem nenhuma área liberada (caso raro: o formulário exige pelo menos uma). */
export default function NoAccessPage() {
  return (
    <AuthLayout title="Nenhuma área liberada">
      <Alert tone="info">Sua conta existe, mas ainda não tem acesso a nenhuma área da academia. Peça para quem tem acesso total liberar o que você vai usar.</Alert>
      <form action={logout}><button type="submit" className="btn btn--large">Sair</button></form>
    </AuthLayout>
  );
}
