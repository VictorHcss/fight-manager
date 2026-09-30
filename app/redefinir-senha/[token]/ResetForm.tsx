"use client";

import { useActionState } from "react";
import { PasswordInput, Submit } from "@/components/client";
import { resetAction, type ResetState } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetAction.bind(null, token), {} as ResetState);
  const e: Record<string, string> = state.errors ?? {};
  return (
    <form action={action} className="form">
      {state.message && <div className="alert alert--danger" role="alert">{state.message}</div>}
      <div className={`field${e.next ? " has-error" : ""}`}><label htmlFor="next">Nova senha</label><PasswordInput id="next" name="next" autoComplete="new-password" autoFocus />{e.next ? <small className="field-error">{e.next}</small> : <small className="field-hint">Pelo menos 10 caracteres.</small>}</div>
      <div className={`field${e.confirm ? " has-error" : ""}`}><label htmlFor="confirm">Repita a nova senha</label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" />{e.confirm && <small className="field-error">{e.confirm}</small>}</div>
      <Submit pending="Salvando…" className="btn btn--primary btn--large">Salvar nova senha</Submit>
    </form>
  );
}
