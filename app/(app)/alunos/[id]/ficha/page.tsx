import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAddress } from "@/components/AddressFields";
import { BrandMark } from "@/components/Brand";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isUuid, orNotFound } from "@/lib/page";
import { getAcademy } from "@/services/academy";
import { guardiansOf, isMinor } from "@/services/guardians";
import { getHealth, getStudent } from "@/services/students";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Ficha de matrícula" };

/** Ficha para impressão: dados do cadastro + termos escritos pela academia + assinaturas. */
export default async function EnrollmentSheet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saude?: string }> }) {
  const ctx = await requireAcademyAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const withHealth = (await searchParams).saude === "1";
  const [academy, s, guardians] = await Promise.all([getAcademy(ctx), orNotFound(getStudent(ctx, id)), guardiansOf(ctx, id)]);
  const health = withHealth ? await getHealth(ctx, id) : null;
  const minor = isMinor(s.birthDate);
  const primary = guardians.find((g) => g.isPrimary);
  const signer = minor && primary ? primary : null;
  const terms = (academy.enrollmentTerms ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const line = (label: string, value: string | null | undefined) => <div className="sheet-field"><span>{label}</span><strong>{value || "\u00a0"}</strong></div>;

  return (
    <div className="sheet-page">
      <div className="sheet-toolbar no-print">
        <Link href={`/alunos/${id}`} className="btn btn--ghost">← Voltar ao perfil</Link>
        <Link href={`/alunos/${id}/ficha${withHealth ? "" : "?saude=1"}`} className="btn" replace>{withHealth ? "Tirar observações de saúde" : "Incluir observações de saúde"}</Link>
        <PrintButton />
      </div>
      {terms.length === 0 && <p className="alert alert--info no-print">A academia ainda não escreveu os termos da matrícula. <Link href="/configuracoes?aba=ficha">Escrever os termos</Link></p>}

      <article className="sheet">
        <header className="sheet-head">
          <BrandMark size={34} />
          <div>
            <strong>{academy.name}</strong>
            <span>{[academy.document, academy.phone, academy.email].filter(Boolean).join(", ")}</span>
            <span>{formatAddress(academy)}</span>
          </div>
        </header>
        <h1>Ficha de matrícula</h1>

        <h2>Aluno</h2>
        <div className="sheet-grid">
          {line("Nome", s.name)}{line("Data de nascimento", formatDate(s.birthDate))}
          {line("CPF", s.cpf)}{line("Telefone", s.phone)}
          {line("E-mail", s.email)}{line("Endereço", formatAddress(s))}
        </div>

        {guardians.length > 0 && (
          <>
            <h2>{guardians.length > 1 ? "Responsáveis" : "Responsável legal"}</h2>
            {guardians.map((g) => (
              <div key={g.id} className="sheet-grid">
                {line(g.isPrimary ? "Responsável principal" : "Responsável", `${g.name} (${g.relationship})`)}{line("CPF", g.cpf)}
                {line("Telefone", g.phone)}{line("E-mail", g.email)}
                {g.isPrimary && line("Endereço", formatAddress(g))}
              </div>
            ))}
          </>
        )}

        <h2>Matrícula</h2>
        <div className="sheet-grid">
          {line("Modalidade", s.modality)}{line("Data de início", formatDate(s.joinedAt))}
          {line("Mensalidade", s.monthlyFeeCents === null ? null : formatMoney(s.monthlyFeeCents))}{line("Vencimento", `Todo dia ${s.dueDay}`)}
        </div>

        <h2>Emergência e imagem</h2>
        <div className="sheet-grid">
          {line("Contato de emergência", s.emergencyName ? `${s.emergencyName}${s.emergencyRelation ? ` (${s.emergencyRelation})` : ""}` : null)}{line("Telefone", s.emergencyPhone)}
        </div>
        <p className="sheet-check">
          <span>{s.imageConsent === true ? "☒" : "☐"} Autorizo</span> <span>{s.imageConsent === false ? "☒" : "☐"} Não autorizo</span>{" "}
          o uso de imagem {minor ? "do aluno" : ""} em fotos e vídeos de treinos e eventos da academia.
        </p>

        {health && (
          <>
            <h2>Saúde</h2>
            <p>{health.notes || "Nenhuma observação registrada."}</p>
          </>
        )}

        {terms.length > 0 && (
          <>
            <h2>Termos</h2>
            <div className="sheet-terms">{terms.map((t, i) => <p key={i}>{t}</p>)}</div>
          </>
        )}

        <p className="sheet-date">{academy.city ?? "________________"}, ____ de ______________ de ______.</p>
        <div className="sheet-signs">
          <div><span />{signer ? `${signer.name}, responsável legal${signer.cpf ? `, CPF ${signer.cpf}` : ""}` : `${s.name}${s.cpf ? `, CPF ${s.cpf}` : ""}`}</div>
          <div><span />{academy.name}</div>
        </div>
      </article>
    </div>
  );
}
