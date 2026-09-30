"use client";

import { useActionState } from "react";
import { Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { generateFeesAction } from "../actions";

export function GenerateForm({ reference }: { reference: string }) {
  const [state, action] = useActionState(generateFeesAction, {});
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Mês de referência" name="reference" error={state.errors?.reference}>
        <input id="reference" name="reference" type="month" defaultValue={state.values?.reference ?? reference} required />
      </Field>
      <div className="form-actions"><Submit pending="Gerando…">Gerar mensalidades</Submit></div>
    </form>
  );
}
