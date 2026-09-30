"use client";

import { useActionState } from "react";
import { Submit } from "@/components/client";
import { emailInviteAction, type EmailInviteState } from "./actions";

export function EmailInviteForm() {
  const [state, action] = useActionState(emailInviteAction, {} as EmailInviteState);
  const error = state.errors?.email ?? state.message;
  return (
    <form action={action} className="add-by-email" noValidate key={state.sent ?? "form"}>
      {state.sent && <div className="alert alert--ok" role="status">Convite enviado para {state.sent}.</div>}
      <div className={`field${error ? " has-error" : ""}`}>
        <label htmlFor="invite-email">E-mail</label>
        <div className="add-by-email-row">
          <input id="invite-email" name="email" type="email" autoComplete="off" placeholder="aluno@email.com" defaultValue={state.sent ? "" : state.values?.email} required />
          <Submit pending="Enviando…">Enviar convite</Submit>
        </div>
        {error && <small className="field-error">{error}</small>}
      </div>
    </form>
  );
}
