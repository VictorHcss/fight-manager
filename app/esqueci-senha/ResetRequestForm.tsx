"use client";

import { useActionState } from "react";
import { Submit } from "@/components/client";
import { requestResetAction } from "./actions";

export function ResetRequestForm() {
  const [state, action] = useActionState(requestResetAction, {});
  if (state.sent) {
    return (
      <div className="alert alert--ok" role="status">
        Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha. Ele vale por 30 minutos. Confira também a caixa de spam.
      </div>
    );
  }
  return (
    <form action={action} className="form">
      {state.message && <div className="alert alert--danger" role="alert">{state.message}</div>}
      <div className="field"><label htmlFor="email">E-mail da conta</label><input id="email" name="email" type="email" autoComplete="username" required autoFocus /></div>
      <Submit pending="Enviando…" className="btn btn--primary btn--large">Enviar link</Submit>
    </form>
  );
}
