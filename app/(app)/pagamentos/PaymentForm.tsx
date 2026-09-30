"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MoneyInput, StudentSearch, Submit, type StudentOption } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { searchStudentsAction } from "../alunos/actions";
import { createPaymentAction } from "./actions";

export function PaymentForm({ student, fees, feeId, amount, today }: {
  student: StudentOption | null;
  fees: { id: string; label: string; balance: string }[];
  feeId: string;
  amount: string;
  today: string;
}) {
  const [state, action] = useActionState(createPaymentAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};

  /** Ao trocar a mensalidade, sugere o saldo restante dela. */
  const studentId = student?.id ?? "";
  const pickFee = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const f = fees.find((x) => x.id === event.target.value);
    const input = event.target.form?.elements.namedItem("amount") as HTMLInputElement | null;
    if (input) input.value = f ? f.balance : "";
  };

  return (
    <form action={action} className="card form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <div className="span-2"><Field label="Aluno" name="studentId" error={e.studentId}><StudentSearch key={studentId} search={searchStudentsAction} initial={student} param="aluno" error={e.studentId} /></Field></div>
        {studentId && (
          <div className="span-2"><Field label="Mensalidade" name="feeId" error={e.feeId} hint={fees.length ? "Deixe em branco para um pagamento avulso (sem mensalidade)." : "Este aluno não tem mensalidades em aberto; o pagamento será avulso."}>
            <select key={String(v.feeId ?? feeId)} id="feeId" name="feeId" defaultValue={v.feeId ?? feeId} onChange={pickFee}>
              <option value="">Pagamento avulso</option>
              {fees.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field></div>
        )}
        <Field label="Valor (R$)" name="amount" error={e.amount} hint="Pagamento parcial é permitido: o saldo continua em aberto.">
          <MoneyInput key={`${studentId}-${feeId}-${v.amount ?? amount}`} id="amount" name="amount" defaultValue={v.amount ?? amount} required invalid={!!e.amount} />
        </Field>
        <Field label="Data do pagamento" name="paidAt" error={e.paidAt}><input id="paidAt" name="paidAt" type="date" defaultValue={v.paidAt ?? today} required /></Field>
        <Field label="Forma de pagamento" name="method" error={e.method}>
          <select key={String(v.method ?? "pix")} id="method" name="method" defaultValue={v.method ?? "pix"}>
            <option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit">Cartão de débito</option><option value="credit">Cartão de crédito</option><option value="other">Outro</option>
          </select>
        </Field>
        <Field label="Status" name="status" error={e.status} hint="Aguardando confirmação: combinado, mas ainda não recebido. Só entra no caixa depois de confirmado.">
          <select key={String(v.status ?? "paid")} id="status" name="status" defaultValue={v.status ?? "paid"}><option value="paid">Pago</option><option value="pending">Aguardando confirmação</option></select>
        </Field>
        <Field label="Referência (opcional)" name="reference" error={e.reference}><input id="reference" name="reference" defaultValue={v.reference} maxLength={60} placeholder="Ex.: matrícula, kimono" /></Field>
        <Field label="Observação" name="notes" error={e.notes}><input id="notes" name="notes" defaultValue={v.notes} maxLength={500} /></Field>
      </div>
      <div className="form-actions"><Submit pending="Registrando…">Registrar pagamento</Submit><Link href="/pagamentos" className="btn btn--ghost">Cancelar</Link></div>
    </form>
  );
}
