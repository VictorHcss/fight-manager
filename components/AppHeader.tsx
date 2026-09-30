import Link from "next/link";
import { Brand } from "./Brand";
import { initials } from "@/lib/initials";

/** Cabeçalho das áreas sem menu lateral (aluno e plataforma): marca, quem está conectado e Sair. */
export function AppHeader({ user, role, home, logout }: { user: string; role: string; home: string; logout: () => void }) {
  return (
    <header className="app-header">
      <Link href={home} className="brand-link"><Brand subtitle={role} /></Link>
      <div className="app-header-user">
        <span className="avatar avatar--small" aria-hidden="true">{initials(user)}</span>
        <span className="app-header-name">{user}</span>
        <form action={logout}><button type="submit" className="btn btn--small btn--on-dark">Sair</button></form>
      </div>
    </header>
  );
}
