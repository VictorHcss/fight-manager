"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AddressFields } from "@/components/AddressFields";
import { MoneyInput, Submit } from "@/components/client";
import { Alert, Field } from "@/components/ui";
import type { ActionState } from "@/lib/action";
import { centsToInput } from "@/lib/money";
import { searchGuardiansAction } from "./actions";

export type StudentValues = Record<string, string>;
export interface ModalityOption { id: string; name: string; defaultFeeCents: number | null }

/** Idade hoje, calculada no navegador só para decidir se mostra os campos de responsável (o servidor confere de novo). */
function age(birth: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const [y, m, d] = birth.split("-").map(Number);
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
}

export function StudentForm({ action, initial, modalities, cancelHref, submitLabel, primaryGuardian }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  initial: StudentValues;
  modalities: ModalityOption[];
  cancelHref: string;
  submitLabel: string;
  /** Na edição: responsável principal já ligado (então a seção de responsável não é exigida aqui). */
  primaryGuardian?: string | null;
}) {
  const [state, formAction] = useActionState(action, {});
  const v: StudentValues = { ...initial, ...state.values };
  const e = state.errors ?? {};
  const [birth, setBirth] = useState(v.birthDate ?? "");
  const minor = (age(birth) ?? 99) < 18;

  /** Ao escolher a modalidade, sugere o valor dela (se o campo estiver vazio). */
  const pickModality = (id: string) => {
    const m = modalities.find((x) => x.id === id);
    const fee = document.getElementById("monthlyFee") as HTMLInputElement | null;
    if (m?.defaultFeeCents && fee && !fee.value) fee.value = centsToInput(m.defaultFeeCents).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  return (
    <form action={formAction} className="card form" noValidate>
      {state.message && <Alert tone="danger">{state.message}</Alert>}

      <h3 className="form-section">Dados pessoais</h3>
      <div className="form-grid">
        <Field label="Nome completo" name="name" error={e.name}><input id="name" name="name" defaultValue={v.name} required maxLength={120} autoComplete="off" /></Field>
        <Field label="Data de nascimento" name="birthDate" error={e.birthDate} hint={minor ? "Menor de idade: informe o responsável abaixo." : undefined}>
          <input id="birthDate" name="birthDate" type="date" defaultValue={v.birthDate} required onChange={(ev) => setBirth(ev.target.value)} />
        </Field>
        <Field label="CPF (opcional)" name="cpf" error={e.cpf}><input id="cpf" name="cpf" defaultValue={v.cpf} inputMode="numeric" placeholder="000.000.000-00" /></Field>
        <Field label="Telefone" name="phone" error={e.phone} hint={minor ? "Do próprio aluno, se tiver. As cobranças vão para o responsável." : undefined}><input id="phone" name="phone" defaultValue={v.phone} inputMode="tel" placeholder="(33) 99999-0000" /></Field>
        <div className="span-2"><Field label="E-mail" name="email" error={e.email}><input id="email" name="email" type="email" defaultValue={v.email} /></Field></div>
      </div>

      {minor && (
        primaryGuardian ? (
          <p className="alert alert--info" style={{ margin: 0 }}>Responsável principal: <strong>{primaryGuardian}</strong>. Para alterar ou adicionar outro, use a seção Responsáveis no perfil do aluno.</p>
        ) : (
          <GuardianFields values={v} errors={e} />
        )
      )}

      <h3 className="form-section">Matrícula</h3>
      <div className="form-grid">
        <Field label="Modalidade" name="modalityId" error={e.modalityId}>
          <select key={String(v.modalityId)} id="modalityId" name="modalityId" defaultValue={v.modalityId} required onChange={(ev) => pickModality(ev.target.value)}>
            <option value="">Escolha…</option>
            {modalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Data de entrada" name="joinedAt" error={e.joinedAt}><input id="joinedAt" name="joinedAt" type="date" defaultValue={v.joinedAt} required /></Field>
        <Field label="Valor mensal" name="monthlyFee" error={e.monthlyFee} hint="Usado como padrão nas mensalidades"><MoneyInput id="monthlyFee" name="monthlyFee" defaultValue={v.monthlyFee} required invalid={!!e.monthlyFee} /></Field>
        <Field label="Dia de vencimento" name="dueDay" error={e.dueDay} hint="Usado em todas as mensalidades futuras"><input id="dueDay" name="dueDay" type="number" min={1} max={31} defaultValue={v.dueDay} required /></Field>
        <Field label="Status" name="status" error={e.status}>
          <select key={String(v.status)} id="status" name="status" defaultValue={v.status}><option value="active">Ativo</option><option value="inactive">Inativo</option></select>
        </Field>
      </div>
      {modalities.length === 0 && <Alert tone="info">Nenhuma modalidade cadastrada. <Link href="/configuracoes?aba=modalidades">Cadastre as modalidades da academia</Link> antes de matricular alunos.</Alert>}

      <h3 className="form-section">Contato de emergência</h3>
      <div className="form-grid">
        <Field label="Nome" name="emergencyName" error={e.emergencyName}><input id="emergencyName" name="emergencyName" defaultValue={v.emergencyName} /></Field>
        <Field label="Telefone" name="emergencyPhone" error={e.emergencyPhone}><input id="emergencyPhone" name="emergencyPhone" defaultValue={v.emergencyPhone} inputMode="tel" /></Field>
        <Field label="Relação" name="emergencyRelation" error={e.emergencyRelation}><input id="emergencyRelation" name="emergencyRelation" defaultValue={v.emergencyRelation} placeholder="Ex.: esposa, pai, amigo" /></Field>
      </div>

      <h3 className="form-section">Uso de imagem</h3>
      <fieldset className="radio-row">
        <legend className="visually-hidden">Autoriza o uso de imagem</legend>
        {[["sim", "Autoriza fotos e vídeos em treinos e eventos"], ["nao", "Não autoriza"], ["", "Ainda não perguntado"]].map(([value, label]) => (
          <label key={value} className="check"><input type="radio" name="imageConsent" value={value} defaultChecked={(v.imageConsent ?? "") === value} /> {label}</label>
        ))}
      </fieldset>

      <details className="form-more" open={!!(v.zip || v.street || v.city || e.zip || e.state)}>
        <summary>Endereço (opcional)</summary>
        <AddressFields values={v} errors={e} />
      </details>

      <Field label="Observações" name="notes" error={e.notes}><textarea id="notes" name="notes" defaultValue={v.notes} maxLength={1000} /></Field>
      <p className="small muted" style={{ margin: 0 }}>Informações de saúde ficam numa seção restrita do perfil, com consentimento próprio.</p>
      <div className="form-actions"><Submit>{submitLabel}</Submit><Link href={cancelHref} className="btn btn--ghost">Cancelar</Link></div>
    </form>
  );
}

interface GuardianOption { id: string; name: string; phone: string; email: string | null; children: string | null }

/** Responsável do menor: escolher um já cadastrado (irmãos) ou informar um novo. */
function GuardianFields({ values, errors }: { values: StudentValues; errors: Record<string, string> }) {
  const [mode, setMode] = useState<"novo" | "existente">(values.guardianId ? "existente" : "novo");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GuardianOption[]>([]);
  const [chosen, setChosen] = useState<GuardianOption | null>(null);

  const term = q.trim();
  useEffect(() => {
    if (mode !== "existente" || term.length < 2) return;
    let current = true;
    const t = setTimeout(() => { searchGuardiansAction(term).then((r) => current && setResults(r)); }, 200);
    return () => { current = false; clearTimeout(t); };
  }, [term, mode]);
  const shown = mode === "existente" && term.length >= 2 ? results : [];

  return (
    <section className="guardian-box" aria-label="Responsável legal">
      <h3 className="form-section" style={{ marginTop: 0 }}>Responsável legal</h3>
      <p className="small muted" style={{ margin: "0 0 0.6rem" }}>É o contato principal para questões administrativas e financeiras, e assina a ficha de matrícula.</p>
      {errors.guardianName && !chosen && <p className="field-error" style={{ marginTop: 0 }}>{errors.guardianName}</p>}
      <div className="segmented" role="radiogroup" aria-label="Responsável">
        <button type="button" role="radio" aria-checked={mode === "novo"} onClick={() => { setMode("novo"); setChosen(null); }}>Novo responsável</button>
        <button type="button" role="radio" aria-checked={mode === "existente"} onClick={() => setMode("existente")}>Já cadastrado (irmãos)</button>
      </div>
      {mode === "existente" ? (
        <div className="form-grid" style={{ marginTop: "0.8rem" }}>
          <div className="span-2">
            <input type="hidden" name="guardianId" value={chosen?.id ?? ""} />
            {chosen ? (
              <div className="picked"><span className="student-line"><strong>{chosen.name}</strong><span className="muted small">{chosen.phone}{chosen.children ? `, responsável por ${chosen.children}` : ""}</span></span>
                <button type="button" className="btn btn--small btn--ghost" onClick={() => setChosen(null)}>Trocar</button></div>
            ) : (
              <div className="combo">
                <input type="search" aria-label="Buscar responsável" placeholder="Nome ou telefone do responsável" value={q} onChange={(ev) => setQ(ev.target.value)} autoComplete="off" />
                {shown.length > 0 && (
                  <ul className="combo-list" role="listbox">
                    {shown.map((g) => (
                      <li key={g.id} role="option" aria-selected={false} onMouseDown={(ev) => { ev.preventDefault(); setChosen(g); setQ(""); }}>
                        <span className="student-line"><strong>{g.name}</strong><span className="muted small">{g.phone}{g.children ? `, responsável por ${g.children}` : ""}</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <Field label="Parentesco" name="guardianRelationship" error={errors.guardianRelationship}><input id="guardianRelationship" name="guardianRelationship" defaultValue={values.guardianRelationship} placeholder="Ex.: mãe, pai, avó" /></Field>
        </div>
      ) : (
        <div className="form-grid" style={{ marginTop: "0.8rem" }}>
          <Field label="Nome do responsável" name="guardianName" error={errors.guardianName && !values.guardianName ? "Informe o nome." : undefined}><input id="guardianName" name="guardianName" defaultValue={values.guardianName} /></Field>
          <Field label="Parentesco" name="guardianRelationship" error={errors.guardianRelationship}><input id="guardianRelationship" name="guardianRelationship" defaultValue={values.guardianRelationship} placeholder="Ex.: mãe, pai, avó" /></Field>
          <Field label="Telefone (WhatsApp)" name="guardianPhone" error={errors.guardianPhone}><input id="guardianPhone" name="guardianPhone" defaultValue={values.guardianPhone} inputMode="tel" /></Field>
          <Field label="CPF (opcional)" name="guardianCpf" error={errors.guardianCpf}><input id="guardianCpf" name="guardianCpf" defaultValue={values.guardianCpf} inputMode="numeric" /></Field>
          <div className="span-2"><Field label="E-mail (opcional)" name="guardianEmail" error={errors.guardianEmail}><input id="guardianEmail" name="guardianEmail" type="email" defaultValue={values.guardianEmail} /></Field></div>
        </div>
      )}
    </section>
  );
}
