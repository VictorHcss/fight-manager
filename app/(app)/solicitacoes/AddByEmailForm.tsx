"use client";

import { useActionState } from "react";
import { Submit } from "@/components/client";
import type { ActionState } from "@/lib/action";
import { addByEmailAction } from "./actions";

/** Adicionar aluno que já criou a conta: só pelo e-mail exato que a pessoa informou. */
export function AddByEmailForm() {
  const [state, action] = useActionState(addByEmailAction, {} as ActionState);
  // erro de formato: a mensagem do campo; conta não encontrada ou já adicionada: a explicação completa
  const error = state.message && state.message !== "Confira os campos destacados." ? state.message : state.errors?.email;
  return (
    <form action={action} className="add-by-email" noValidate>
      <div className={`field${state.errors?.email ? " has-error" : ""}`}>
        <label htmlFor="add-email">E-mail da conta do aluno</label>
        <div className="add-by-email-row">
          <input id="add-email" name="email" type="email" autoComplete="off" placeholder="aluno@email.com" defaultValue={state.values?.email} required aria-describedby={error ? "add-email-error" : "add-email-hint"} />
          <Submit pending="Procurando…">Adicionar</Submit>
        </div>
        {error ? <small className="field-error" id="add-email-error">{error}</small>
          : <small className="field-hint" id="add-email-hint">Para quem criou a conta em &quot;Criar conta&quot;. Depois você completa modalidade e mensalidade abaixo.</small>}
      </div>
    </form>
  );
}
