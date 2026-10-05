import type { Metadata } from "next";
import Link from "next/link";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, formatReference } from "@/lib/dates";
import { PAYMENT_METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { academyReport } from "@/services/reports";

export const metadata: Metadata = { title: "Relatórios" };
const PERIODS = [3, 6, 12] as const;
const ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const short = (ref: string) => `${ABBR[Number(ref.slice(5, 7)) - 1]}/${ref.slice(2, 4)}`;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ meses?: string }> }) {
  const ctx = await requireAcademyAdmin("financeiro");
  const sp = await searchParams;
  const months = PERIODS.find((p) => String(p) === sp.meses) ?? 6;
  const r = await academyReport(ctx, months);
  const max = Math.max(1, ...r.months.map((m) => m.expectedCents));
  const rate = r.totals.expectedCents ? Math.round((r.totals.receivedCents / r.totals.expectedCents) * 100) : null;
  const modalityTotal = r.byModality.reduce((t, m) => t + m.cents, 0) || 1;
  const methodTotal = r.byMethod.reduce((t, m) => t + m.cents, 0) || 1;

  return (
    <>
      <PageHeader title="Relatórios" description={`De ${formatDate(r.from)} a ${formatDate(r.to)}. Mensalidades canceladas ficam de fora.`}
        actions={<nav className="segmented" aria-label="Período">{PERIODS.map((p) => <Link key={p} href={`/relatorios?meses=${p}`} aria-current={p === months ? "page" : undefined}>{p} meses</Link>)}</nav>} />

      <div className="stats">
        <Stat label="Recebido das mensalidades" value={formatMoney(r.totals.receivedCents)} tone="ok" hint={`de ${formatMoney(r.totals.expectedCents)} esperados`} />
        <Stat label="Taxa de recebimento" value={rate === null ? "–" : `${rate}%`} tone={rate !== null && rate < 80 ? "warn" : "ok"} hint="Recebido ÷ esperado" />
        <Stat label="Em atraso hoje" value={formatMoney(r.totals.overdueCents)} tone={r.totals.overdueCents ? "danger" : "ok"} hint="Mensalidades vencidas do período" />
        <Stat label="Alunos novos" value={r.totals.newStudents} hint={`${r.totals.active} ativos hoje`} />
      </div>

      <Card title="Mensalidades por mês">
        {r.months.every((m) => !m.count) ? <Empty title="Sem mensalidades no período" text="Gere as mensalidades do mês para os relatórios aparecerem." /> : (
          <>
            <div className="bars" role="img" aria-label="Gráfico de barras: esperado e recebido por mês. Os números estão na tabela abaixo.">
              {r.months.map((m) => (
                <div key={m.reference} className="bar-col">
                  <div className="bar-track">
                    <span className="bar bar--expected" style={{ height: `${(m.expectedCents / max) * 100}%` }} />
                    <span className="bar bar--received" style={{ height: `${(m.receivedCents / max) * 100}%` }} />
                  </div>
                  <span className="bar-label">{short(m.reference)}</span>
                  <span className="bar-pct">{m.pct === null ? "–" : `${m.pct}%`}</span>
                </div>
              ))}
            </div>
            <p className="legend small"><span className="dot dot--expected" />Esperado <span className="dot dot--received" />Recebido</p>
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Mês</th><th className="num">Esperado</th><th className="num">Recebido</th><th className="num">Em aberto</th><th className="num">Atrasado</th><th className="num">Novos alunos</th></tr></thead>
              <tbody>{[...r.months].reverse().map((m) => (
                <tr key={m.reference}>
                  <td className="primary">{formatReference(m.reference)}</td>
                  <td data-label="Esperado" className="num">{formatMoney(m.expectedCents)}</td>
                  <td data-label="Recebido" className="num">{formatMoney(m.receivedCents)}{m.pct !== null && <span className="small muted"> ({m.pct}%)</span>}</td>
                  <td data-label="Em aberto" className="num">{formatMoney(m.openCents)}</td>
                  <td data-label="Atrasado" className="num">{m.overdueCents ? <Link href={`/mensalidades?status=overdue`} className="tone-danger">{formatMoney(m.overdueCents)} ({m.overdueCount})</Link> : "–"}</td>
                  <td data-label="Novos alunos" className="num">{m.newStudents}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </>
        )}
      </Card>

      <div className="grid grid--2 report-split">
        <Card title="Recebido por modalidade">
          {r.byModality.length === 0 ? <Empty title="Nenhum pagamento no período" /> : (
            <ul className="hbars">{r.byModality.map((m) => (
              <li key={m.name}>
                <div className="hbar-head"><strong>{m.name}</strong><span>{formatMoney(m.cents)}</span></div>
                <div className="hbar"><span style={{ width: `${(m.cents / modalityTotal) * 100}%` }} /></div>
                <small className="muted">{Math.round((m.cents / modalityTotal) * 100)}% · {m.students} aluno(s) pagante(s)</small>
              </li>
            ))}</ul>
          )}
        </Card>
        <Card title="Formas de pagamento">
          {r.byMethod.length === 0 ? <Empty title="Nenhum pagamento no período" /> : (
            <ul className="hbars">{r.byMethod.map((m) => (
              <li key={m.method}>
                <div className="hbar-head"><strong>{PAYMENT_METHODS[m.method]}</strong><span>{formatMoney(m.cents)}</span></div>
                <div className="hbar hbar--alt"><span style={{ width: `${(m.cents / methodTotal) * 100}%` }} /></div>
                <small className="muted">{Math.round((m.cents / methodTotal) * 100)}% · {m.count} pagamento(s)</small>
              </li>
            ))}</ul>
          )}
        </Card>
      </div>
    </>
  );
}
