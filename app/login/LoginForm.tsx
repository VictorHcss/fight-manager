"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput, Submit } from "@/components/client";
import { login } from "./actions";

export function LoginForm({ notice, next }: { notice?: string; next?: string }) {
  const [state, action] = useActionState(login, {});
  return (
    <form action={action} className="form auth-form">
      {next && <input type="hidden" name="next" value={next} />}
      {(state.message || notice) && <div className="alert alert--danger" role="alert">{state.message ?? notice}</div>}
      <div className="field"><label htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={state.email} key={state.email} /></div>
      <div className="field">
        <div className="field-row"><label htmlFor="password">Senha</label><Link href="/esqueci-senha" className="field-link">Esqueci minha senha</Link></div>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>
      <Submit pending="Entrando…" className="btn btn--primary btn--large">Entrar</Submit>
    </form>
  );
}
