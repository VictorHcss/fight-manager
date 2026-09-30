"use client";

import { useActionState } from "react";
import { PasswordInput, Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { accountConsentText } from "@/lib/consent";
import { inviteCodeAction, studentSignupAction } from "./actions";

export function StudentSignupForm() {
  const [state, action] = useActionState(studentSignupAction, {} as ActionState);
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Nome completo" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name} autoComplete="name" required autoFocus /></Field>
      <Field label="E-mail" name="email" error={e.email} hint="A academia usa este e-mail para adicionar você.">
        <input id="email" name="email" type="email" defaultValue={v.email} autoComplete="email" required />
      </Field>
      <div className="form-grid">
        <Field label="Telefone (com DDD)" name="phone" error={e.phone}><input id="phone" name="phone" defaultValue={v.phone} inputMode="tel" autoComplete="tel" placeholder="(33) 99999-0000" required /></Field>
        <Field label="Data de nascimento" name="birthDate" error={e.birthDate} hint="Para maiores de 18 anos."><input id="birthDate" name="birthDate" type="date" defaultValue={v.birthDate} required /></Field>
        <Field label="Senha" name="password" error={e.password} hint="Pelo menos 10 caracteres."><PasswordInput id="password" name="password" autoComplete="new-password" /></Field>
        <Field label="Repita a senha" name="confirm" error={e.confirm}><PasswordInput id="confirm" name="confirm" autoComplete="new-password" /></Field>
      </div>
      <div className={`field${e.consent ? " has-error" : ""}`}>
        <label className="check"><input type="checkbox" name="consent" defaultChecked={v.consent === "on"} /> {accountConsentText()}</label>
        {e.consent && <small className="field-error">{e.consent}</small>}
      </div>
      <Submit pending="Criando conta…" className="btn btn--primary btn--large">Criar minha conta</Submit>
    </form>
  );
}

export function InviteCodeForm() {
  const [state, action] = useActionState(inviteCodeAction, {} as ActionState);
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Código ou link do convite" name="code" error={e.code} hint="Está no QR Code da recepção ou na mensagem que a academia enviou.">
        <input id="code" name="code" defaultValue={state.values?.code} autoComplete="off" spellCheck={false} autoCapitalize="none" required autoFocus />
      </Field>
      <Submit pending="Conferindo…" className="btn btn--primary btn--large">Continuar</Submit>
    </form>
  );
}
