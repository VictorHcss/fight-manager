"use client";

import { useActionState } from "react";
import { PasswordInput, Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { studentPasswordAction, updateContactAction } from "./actions";

export function ContactForm({ phone }: { phone: string | null }) {
  const [state, action] = useActionState(updateContactAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Telefone (WhatsApp)" name="phone" error={e.phone} hint="Com DDD. A academia usa este número para falar com você.">
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={state.values?.phone ?? phone ?? ""} required
          aria-invalid={!!e.phone} aria-describedby={e.phone ? "phone-error" : undefined} />
      </Field>
      <div className="form-actions"><Submit>Salvar telefone</Submit></div>
    </form>
  );
}

export function StudentPasswordForm() {
  const [state, action] = useActionState(studentPasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Senha atual" name="current" error={e.current}><PasswordInput id="current" name="current" autoComplete="current-password" /></Field>
      <Field label="Nova senha" name="next" error={e.next} hint="Pelo menos 10 caracteres."><PasswordInput id="next" name="next" autoComplete="new-password" /></Field>
      <Field label="Repita a nova senha" name="confirm" error={e.confirm}><PasswordInput id="confirm" name="confirm" autoComplete="new-password" /></Field>
      <div className="form-actions"><Submit>Trocar senha</Submit></div>
    </form>
  );
}
