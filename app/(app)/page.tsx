import Link from "next/link";
import { Alert, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { can, type Permission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { firstArea, requireAcademyAdmin } from "@/lib/auth/guards";
import { currentReferenceIn, formatDate, formatReference, shortReference } from "@/lib/dates";
import { FEE_STATUS_LABEL } from "@/lib/fee-status";
import { formatMoney } from "@/lib/money";
import { setupStatus } from "@/services/academy";
import { dashboard } from "@/services/dashboard";
import { reminderText, whatsappLink } from "@/lib/whatsapp";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const ctx = await requireAcademyAdmin();
  // quem não cuida de mensalidades começa na primeira área liberada (sem aviso: é o caminho normal depois do login)
  if (!can(ctx.permissions, "mensalidades")) redirect(firstArea(ctx.permissions));
  const { erro } = await searchParams;
  const allow = (p: Permission) => can(ctx.permissions, p);
  const reference = currentReferenceIn(ctx.timezone);
  const [d, setup] = await Promise.all([dashboard(ctx, reference), setupStatus(ctx)]);
  const pendencias = [...d.overdue, ...d.upcoming].slice(0, 10);

  const academy = ctx.user.academyName ?? "academia";

  return (
    <>
      <PageHeader title="Início" description={`Resumo de ${formatReference(reference)}.`}
        actions={<>{allow("alunos") && <Link href="/alunos/novo" className="btn">Novo aluno</Link>}<Link href="/mensalidades/gerar" className="btn">Gerar mensalidades do mês</Link></>} />
      {erro && <Alert tone="danger">{erro}</Alert>}

      {!setup.complete && allow("configuracoes") && (
        <section className="card setup" aria-label="Configure sua academia">
          <h2>Configure sua academia</h2>
          <p className="small muted">Leva poucos minutos e deixa a ficha de matrícula e o cadastro prontos.</p>
          <ol>{setup.steps.map((st) => <li key={st.key} data-done={st.done}>{st.done ? <span>{st.label}</span> : <Link href={st.href}>{st.label}</Link>}</li>)}</ol>
        </section>
      )}
      {setup.missingBirth > 0 && allow("alunos") && <div className="alert alert--info">{setup.missingBirth} aluno(s) ativo(s) sem data de nascimento. Ela é necessária para identificar menores e exigir o responsável. <Link href="/alunos">Ver alunos</Link></div>}

      <section className={`attention${allow("solicitacoes") ? "" : " attention--2"}`} aria-label="Precisa de atenção">
        <Link href="/mensalidades?status=overdue" className={`attention-card${d.fees.overdueCount ? " is-danger" : " is-ok"}`}>
          <span className="attention-label">Mensalidades atrasadas</span>
          <strong>{d.fees.overdueCount}</strong>
          <span>{d.fees.overdueCount ? `${formatMoney(d.fees.overdueCents)} em aberto` : "Nenhum atraso"}</span>
        </Link>
{allow("solicitacoes") && (
        <Link href="/solicitacoes" className={`attention-card${d.students.requests ? " is-warn" : ""}`}>
          <span className="attention-label">Solicitações de entrada</span>
          <strong>{d.students.requests}</strong>
          <span>{d.students.requests ? "Aguardando sua aprovação" : "Nenhum pedido novo"}</span>
        </Link>
        )}
        <Link href="/mensalidades?status=pending" className="attention-card">
          <span className="attention-label">Mensalidades a vencer</span>
          <strong>{d.fees.pendingCount}</strong>
          <span>{d.fees.pendingCount ? `${formatMoney(d.fees.pendingCents)} em aberto` : "Nada a vencer"}</span>
        </Link>
      </section>

      {d.month.count > 0 && <Collection reference={formatReference(reference)} {...d.month} />}

      <Card title="Pendências" actions={<Link href="/mensalidades?status=overdue" className="small">Ver todas</Link>}>
        {pendencias.length === 0 ? (
          <Empty title="Nenhuma pendência" text="Não há mensalidades atrasadas nem vencendo neste mês." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Aluno</th><th>Referência</th><th>Vencimento</th><th>Situação</th><th className="num">Em aberto</th><th /></tr></thead>
              <tbody>
                {pendencias.map((f) => {
                  const wa = whatsappLink(f.guardianPhone ?? f.studentPhone, reminderText({ name: f.guardianName ?? f.studentName, student: f.guardianName ? f.studentName : undefined, academy, reference: f.reference, dueDate: f.dueDate, openCents: f.balanceCents, overdue: f.displayStatus === "overdue" }));
                  return (
                    <tr key={f.id}>
                      <td className="primary"><Link href={`/alunos/${f.studentId}`}>{f.studentName}</Link></td>
                      <td data-label="Referência">{shortReference(f.reference)}</td>
                      <td data-label="Vencimento">{formatDate(f.dueDate)}</td>
                      <td data-label="Situação"><Badge status={f.displayStatus}>{FEE_STATUS_LABEL[f.displayStatus]}</Badge></td>
                      <td data-label="Em aberto" className="num">{formatMoney(f.balanceCents)}</td>
                      <td><div className="row-actions">
                        {wa && f.displayStatus === "overdue" && <a className="btn btn--small btn--whatsapp" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                        {allow("pagamentos") && <Link href={`/pagamentos/novo?aluno=${f.studentId}&mensalidade=${f.id}`} className="btn btn--small" aria-label={`Registrar pagamento de ${f.studentName}`}>Receber</Link>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {allow("financeiro") && <>
      <h2 className="section-title">Caixa do mês</h2>
      <div className="stats">
        <Stat label="Entradas" value={formatMoney(d.finance.incomeCents)} tone="ok" href="/financeiro?tipo=income" />
        <Stat label="Saídas" value={formatMoney(d.finance.expenseCents)} href="/financeiro?tipo=expense" />
        <Stat label="Saldo" value={formatMoney(d.finance.balanceCents)} tone={d.finance.balanceCents < 0 ? "danger" : "ok"} href="/financeiro" />
        <Stat label="Alunos ativos" value={d.students.active} hint={d.students.inactive ? `${d.students.inactive} inativo(s)` : undefined} href="/alunos" />
      </div>
      </>}
    </>
  );
}

/** Arrecadação das mensalidades do mês: quanto entrou do que era esperado. */
function Collection({ reference, count, expectedCents, receivedCents }: { reference: string; count: number; expectedCents: number; receivedCents: number }) {
  const pct = expectedCents ? Math.min(100, Math.round((receivedCents / expectedCents) * 100)) : 0;
  const missing = Math.max(0, expectedCents - receivedCents);
  return (
    <section className="card collection" aria-label="Arrecadação do mês">
      <div className="collection-head">
        <div>
          <h2>Mensalidades de {reference}</h2>
          <p className="small muted">{count} mensalidade{count > 1 ? "s" : ""} no mês</p>
        </div>
        <p className="collection-total"><strong>{formatMoney(receivedCents)}</strong> <span>de {formatMoney(expectedCents)}</span></p>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${pct}% recebido`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="small collection-foot">{pct}% recebido{missing > 0 ? `, faltam ${formatMoney(missing)}.` : ". Tudo pago."}</p>
    </section>
  );
}
