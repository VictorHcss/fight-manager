import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./Brand";

/**
 * Moldura das telas públicas (entrar, criar conta, esqueci a senha, nova senha, convite).
 * No computador: painel da marca à esquerda (as cordas do ringue) e o formulário à direita.
 * No celular: a marca numa faixa curta em cima e o formulário logo abaixo.
 */
export function AuthLayout({ title, lead, children, footer, wide = false }: {
  title: string; lead?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="true">
        <Link href="/login" className="brand-link auth-side-brand" tabIndex={-1}><Brand /></Link>
        <div className="auth-side-copy">
          <p className="auth-side-title">Seus alunos em dia, sem planilha.</p>
          <p className="auth-side-text">Cadastro, mensalidades, pagamentos e caixa da academia no mesmo lugar, do computador da recepção ao celular do professor.</p>
        </div>
        <Ropes />
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand"><Link href="/login" className="brand-link"><Brand /></Link></div>
        <div className={`auth-panel${wide ? " auth-panel--wide" : ""}`}>
          <h1 className="auth-title">{title}</h1>
          {lead && <div className="auth-lead">{lead}</div>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** As três cordas do ringue, presas em dois córners: o desenho que identifica as telas de entrada. */
function Ropes() {
  return (
    <svg className="auth-ropes" viewBox="0 0 600 220" preserveAspectRatio="none">
      <rect x="18" y="20" width="16" height="200" rx="4" className="rope-post" />
      <rect x="566" y="20" width="16" height="200" rx="4" className="rope-post" />
      <path d="M34 52 Q300 76 566 52" className="rope rope--1" />
      <path d="M34 104 Q300 128 566 104" className="rope rope--2" />
      <path d="M34 156 Q300 180 566 156" className="rope rope--3" />
      <rect x="14" y="40" width="24" height="24" rx="5" className="rope-pad" />
      <rect x="562" y="40" width="24" height="24" rx="5" className="rope-pad" />
    </svg>
  );
}
