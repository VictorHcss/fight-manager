"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { MoneyInput, Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/labels";
import { createEntryAction } from "./actions";

export function EntryForm({ today, type: initialType }: { today: string; type: "income" | "expense" }) {
  const [state, action] = useActionState(createEntryAction, {});
  const v = state.values ?? {};
  const e = state.errors ?? {};
  const [type, setType] = useState<"income" | "expense">((v.type as "income" | "expense") ?? initialType);
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form action={action} className="card form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}
      <div className="form-grid">
        <Field label="Tipo" name="type" error={e.type}>
          <select id="type" name="type" value={type} onChange={(ev) => setType(ev.target.value as "income" | "expense")}>
            <option value="expense">Saída (despesa)</option><option value="income">Entrada</option>
          </select>
        </Field>
        <Field label="Categoria" name="category" error={e.category}>
          <select id="category" name="category" key={type} defaultValue={v.category ?? ""} required>
            <option value="">Escolha…</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="span-2"><Field label="Descrição" name="description" error={e.description}><input id="description" name="description" defaultValue={v.description} maxLength={160} required placeholder={type === "income" ? "Ex.: Matrícula de novo aluno" : "Ex.: Luvas novas"} /></Field></div>
        <Field label="Valor" name="amount" error={e.amount}><MoneyInput id="amount" name="amount" defaultValue={v.amount} required invalid={!!e.amount} /></Field>
        <Field label="Data" name="date" error={e.date}><input id="date" name="date" type="date" defaultValue={v.date ?? today} required /></Field>
        <div className="span-2"><Field label="Observação" name="notes" error={e.notes}><textarea id="notes" name="notes" defaultValue={v.notes} maxLength={500} /></Field></div>
      </div>
      {type === "income" && <p className="small muted" style={{ margin: 0 }}>Mensalidades não entram aqui: elas são lançadas automaticamente quando você registra o pagamento, sem risco de contar duas vezes.</p>}
      <div className="form-actions"><Submit>Registrar lançamento</Submit><Link href="/financeiro" className="btn btn--ghost">Cancelar</Link></div>
    </form>
  );
}
