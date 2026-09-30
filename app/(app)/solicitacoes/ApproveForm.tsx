"use client";

import { useActionState } from "react";
import { MoneyInput, Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/action";

export function ApproveForm({ action, today, id, modalities }: { action: (s: ActionState, f: FormData) => Promise<ActionState>; today: string; id: string; modalities: { id: string; name: string; defaultFeeCents: number | null }[] }) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Modalidade" name={`modality-${id}`} error={e.modalityId}>
          <select key={String(v.modalityId)} id={`modality-${id}`} name="modalityId" defaultValue={v.modalityId} required onChange={(ev) => {
            const m = modalities.find((x) => x.id === ev.target.value);
            const fee = document.getElementById(`monthlyFee-${id}`) as HTMLInputElement | null;
            if (m?.defaultFeeCents && fee && !fee.value) fee.value = (m.defaultFeeCents / 100).toFixed(2).replace(".", ",");
          }}>
            <option value="">Escolha…</option>
            {modalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Data de início" name={`joinedAt-${id}`} error={e.joinedAt}><input id={`joinedAt-${id}`} name="joinedAt" type="date" defaultValue={v.joinedAt ?? today} required /></Field>
        <Field label="Valor mensal" name={`monthlyFee-${id}`} error={e.monthlyFee}><MoneyInput id={`monthlyFee-${id}`} name="monthlyFee" defaultValue={v.monthlyFee} required invalid={!!e.monthlyFee} /></Field>
        <Field label="Dia de vencimento" name={`dueDay-${id}`} error={e.dueDay}><input id={`dueDay-${id}`} name="dueDay" type="number" min={1} max={31} defaultValue={v.dueDay ?? "10"} required /></Field>
        <div className="span-2"><Field label="Observações (opcional)" name={`notes-${id}`} error={e.notes}><input id={`notes-${id}`} name="notes" defaultValue={v.notes} maxLength={1000} /></Field></div>
      </div>
      <div className="form-actions"><Submit pending="Aprovando…">Aprovar como novo aluno</Submit></div>
    </form>
  );
}
