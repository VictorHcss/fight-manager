"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MoneyInput, StudentSearch, Submit, type StudentOption } from "@/components/client";
import { centsToInput } from "@/lib/money";
import { searchStudentsAction } from "../alunos/actions";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/action";

export function FeeForm({ action, initial, pickStudent, student, cancelHref, submitLabel, back }: {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  initial: { studentId: string; amount: string; dueDate: string; reference: string; notes: string };
  pickStudent?: boolean;
  student?: StudentOption | null;
  cancelHref: string;
  submitLabel: string;
  back?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = { ...initial, ...state.values };
  const e = state.errors ?? {};

  /** Ao escolher o aluno, preenche o valor mensal dele. */
  const pick = (s: StudentOption) => {
    const amount = document.getElementById("amount") as HTMLInputElement | null;
    if (amount && s.monthlyFeeCents !== null) amount.value = centsToInput(s.monthlyFeeCents).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  return (
    <form action={formAction} className="card form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      {back && <input type="hidden" name="back" value={back} />}
      <div className="form-grid">
        {pickStudent && (
          <div className="span-2"><Field label="Aluno" name="studentId" error={e.studentId}>
            <StudentSearch search={searchStudentsAction} initial={student} onPick={pick} error={e.studentId} />
          </Field></div>
        )}
        <Field label="Valor" name="amount" error={e.amount}><MoneyInput id="amount" name="amount" defaultValue={v.amount} required invalid={!!e.amount} /></Field>
        <Field label="Período de referência" name="reference" error={e.reference}><input id="reference" name="reference" type="month" defaultValue={v.reference} required /></Field>
        <Field label="Vencimento" name="dueDate" error={e.dueDate}><input id="dueDate" name="dueDate" type="date" defaultValue={v.dueDate} required /></Field>
        <Field label="Observação" name="notes" error={e.notes}><input id="notes" name="notes" defaultValue={v.notes} maxLength={500} /></Field>
      </div>
      <div className="form-actions"><Submit>{submitLabel}</Submit><Link href={cancelHref} className="btn btn--ghost">Cancelar</Link></div>
    </form>
  );
}
