"use client";

import { useActionState, useState } from "react";
import { Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { createAcademyAction, resendAccessAction, type AccessState } from "./actions";

/** Link de acesso recém-gerado: aparece uma vez, com botão de copiar (útil se o e-mail não chegar). */
function AccessLink({ created }: { created: NonNullable<AccessState["created"]> }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="access-link" role="status">
      <p><strong>{created.academy}</strong>: {created.sent
        ? <>link de acesso enviado para <strong>{created.email}</strong>.</>
        : <>o e-mail para <strong>{created.email}</strong> não foi enviado. Copie o link abaixo e mande por WhatsApp ou outro meio.</>}</p>
      <div className="access-link-row">
        <input readOnly value={created.link} aria-label="Link de acesso" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" className="btn btn--small" onClick={async () => { await navigator.clipboard.writeText(created.link); setCopied(true); }}>{copied ? "Copiado" : "Copiar link"}</button>
      </div>
      <p className="small muted">O link vale por 3 dias e só funciona uma vez. Com ele, o responsável cria a senha e entra no painel da academia.</p>
    </div>
  );
}

export function CreateAcademyForm() {
  const [state, action] = useActionState(createAcademyAction, {} as AccessState);
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <>
      {state.created && <AccessLink created={state.created} />}
      <form action={action} className="form" noValidate key={state.created?.link ?? "novo"}>
        {state.message && <Alert tone="danger">{state.message}</Alert>}
        <div className="form-grid form-grid--3">
          <Field label="Nome da academia" name="academyName" error={e.academyName}><input id="academyName" name="academyName" defaultValue={v.academyName} autoComplete="off" required /></Field>
          <Field label="Nome do responsável" name="adminName" error={e.adminName}><input id="adminName" name="adminName" defaultValue={v.adminName} autoComplete="off" required /></Field>
          <Field label="E-mail do responsável" name="adminEmail" error={e.adminEmail} hint="Vira o login da academia."><input id="adminEmail" name="adminEmail" type="email" defaultValue={v.adminEmail} autoComplete="off" required /></Field>
        </div>
        <div className="form-actions"><Submit pending="Criando…">Criar academia e enviar acesso</Submit></div>
      </form>
    </>
  );
}

export function ResendAccessForm({ academyId, academyName }: { academyId: string; academyName: string }) {
  const [state, action] = useActionState(resendAccessAction, {} as AccessState);
  return (
    <form action={action} className="resend">
      <input type="hidden" name="academyId" value={academyId} />
      <input type="hidden" name="academyName" value={academyName} />
      <Submit className="btn btn--small" pending="Gerando…">Novo link de acesso</Submit>
      {state.message && <small className="field-error">{state.message}</small>}
      {state.created && <AccessLink created={state.created} />}
    </form>
  );
}
