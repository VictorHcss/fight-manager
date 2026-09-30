"use client";

import { useActionState } from "react";
import { AddressFields } from "@/components/AddressFields";
import { MoneyInput, Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { changePasswordAction, createUserAction, saveModalityAction, updateAcademyAction, updateTermsAction } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Senha atual" name="current" error={e.current}><input id="current" name="current" type="password" autoComplete="current-password" required /></Field>
      <Field label="Nova senha" name="next" error={e.next} hint="Pelo menos 10 caracteres."><input id="next" name="next" type="password" autoComplete="new-password" required /></Field>
      <Field label="Repita a nova senha" name="confirm" error={e.confirm}><input id="confirm" name="confirm" type="password" autoComplete="new-password" required /></Field>
      <div className="form-actions"><Submit>Trocar senha</Submit></div>
    </form>
  );
}

export function NewUserForm() {
  const [state, action] = useActionState(createUserAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Nome" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name} required /></Field>
        <Field label="E-mail" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={v.email} required /></Field>
        <div className="span-2"><Field label="Senha inicial" name="password" error={e.password} hint="Pelo menos 10 caracteres. Peça para a pessoa trocar no primeiro acesso."><input id="password" name="password" type="password" autoComplete="new-password" required /></Field></div>
      </div>
      <div className="form-actions"><Submit>Criar administrador</Submit></div>
    </form>
  );
}

export function AcademyForm({ initial }: { initial: Record<string, string | null> }) {
  const [state, action] = useActionState(updateAcademyAction, {});
  const v = { ...initial, ...state.values };
  const e = state.errors ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Nome da academia" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name ?? ""} required /></Field>
        <Field label="CPF ou CNPJ (opcional)" name="document" error={e.document} hint="Sai na ficha de matrícula, como identificação da academia."><input id="document" name="document" defaultValue={v.document ?? ""} inputMode="numeric" /></Field>
        <Field label="Telefone ou WhatsApp" name="phone" error={e.phone}><input id="phone" name="phone" defaultValue={v.phone ?? ""} inputMode="tel" /></Field>
        <Field label="E-mail" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={v.email ?? ""} /></Field>
      </div>
      <h3 className="form-section">Endereço</h3>
      <AddressFields values={v} errors={e} />
      <div className="form-actions"><Submit>Salvar dados da academia</Submit></div>
    </form>
  );
}

export function TermsForm({ initial }: { initial: string }) {
  const [state, action] = useActionState(updateTermsAction, {});
  return (
    <form action={action} className="form">
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <Field label="Termos da matrícula" name="terms" hint="Regras, cancelamento, reajuste, uso de equipamentos… Cada linha vira um parágrafo na ficha impressa.">
        <textarea id="terms" name="terms" defaultValue={initial} rows={12} maxLength={20000} />
      </Field>
      <div className="form-actions"><Submit>Salvar termos</Submit></div>
    </form>
  );
}

export function ModalityForm({ id, initial }: { id: string | null; initial?: { name: string; defaultFee: string } }) {
  const [state, action] = useActionState(saveModalityAction.bind(null, id), {});
  const e = state.errors ?? {};
  const v = { ...initial, ...state.values };
  return (
    <form action={action} className="modality-form" noValidate>
      <Field label="Modalidade" name={`name-${id ?? "nova"}`} error={e.name}><input id={`name-${id ?? "nova"}`} name="name" defaultValue={v.name ?? ""} placeholder="Ex.: Muay Thai" required /></Field>
      <Field label="Mensalidade sugerida (opcional)" name={`fee-${id ?? "nova"}`} error={e.defaultFee}><MoneyInput id={`fee-${id ?? "nova"}`} name="defaultFee" defaultValue={v.defaultFee ?? ""} invalid={!!e.defaultFee} /></Field>
      <Submit className="btn btn--primary">{id ? "Salvar" : "Adicionar"}</Submit>
      {state.message && !e.name && <p className="field-error" style={{ gridColumn: "1 / -1" }}>{state.message}</p>}
    </form>
  );
}
