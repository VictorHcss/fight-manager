import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit, FilterToggle } from "@/components/client";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, isValidDate } from "@/lib/dates";
import { FEE_STATUS_LABEL, type DisplayFeeStatus } from "@/lib/fee-status";
import { formatMoney } from "@/lib/money";
import { Pagination } from "@/components/Pagination";
import { offsetOf, PAGE_SIZE, pageFrom, pagesOf } from "@/lib/pagination";
import { feesSummary, listFees } from "@/services/fees";
import { cancelFeeAction } from "./actions";

export const metadata: Metadata = { title: "Mensalidades" };
const STATUSES: DisplayFeeStatus[] = ["pending", "overdue", "paid", "canceled"];

export default async function FeesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAcademyAdmin();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as DisplayFeeStatus) ? (sp.status as DisplayFeeStatus) : undefined;
  const from = sp.de && isValidDate(sp.de) ? sp.de : undefined;
  const to = sp.ate && isValidDate(sp.ate) ? sp.ate : undefined;
  const filters = { status, from, to, q: sp.q };
  const page = pageFrom(sp.pagina);
  const [list, summary] = await Promise.all([listFees(ctx, filters, PAGE_SIZE, offsetOf(page)), feesSummary(ctx, filters)]);
  const here = `/mensalidades?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "ok" && k !== "erro") as [string, string][])}`;

  return (
    <>
      <PageHeader title="Mensalidades" description="Uma mensalidade fica atrasada a partir do dia seguinte ao vencimento."
        actions={<><Link href="/mensalidades/gerar" className="btn">Gerar mensalidades do mês</Link><Link href="/mensalidades/nova" className="btn btn--primary">Nova mensalidade</Link></>} />
      {sp.erro && <Alert tone="danger">{sp.erro}</Alert>}
      <form className="filters" role="search">
        <label>Aluno<input name="q" type="search" defaultValue={sp.q} placeholder="Nome do aluno" /></label>
        <FilterToggle active={[status, from, to].filter(Boolean).length} />
        <div className="filters-more">
        <label>Situação<select key={String(status ?? "")} name="status" defaultValue={status ?? ""}><option value="">Todas</option>{STATUSES.map((s) => <option key={s} value={s}>{FEE_STATUS_LABEL[s]}</option>)}</select></label>
        <label>Vencimento de<input name="de" type="date" defaultValue={from} /></label>
        <label>até<input name="ate" type="date" defaultValue={to} /></label>
          <button type="submit" className="btn">Filtrar</button>
        </div>
      </form>
      <Card title={summary.count ? `${summary.count} mensalidade(s)${summary.openCents ? `, ${formatMoney(summary.openCents)} em aberto` : ""}` : undefined}>
        {list.length === 0 ? (
          <Empty title="Nenhuma mensalidade encontrada" text="Crie uma mensalidade ou gere as do mês para todos os alunos ativos."
            action={<Link href="/mensalidades/gerar" className="btn btn--primary">Gerar mensalidades do mês</Link>} />
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Aluno</th><th>Referência</th><th>Vencimento</th><th>Situação</th><th className="num">Valor</th><th className="num">Em aberto</th><th /></tr></thead>
            <tbody>{list.map((f) => (
              <tr key={f.id}>
                <td className="primary"><Link href={`/alunos/${f.studentId}?aba=mensalidades`}>{f.studentName}</Link></td>
                <td data-label="Referência">{f.reference}</td>
                <td data-label="Vencimento">{formatDate(f.dueDate)}</td>
                <td data-label="Situação"><Badge status={f.displayStatus}>{FEE_STATUS_LABEL[f.displayStatus]}</Badge>{f.paidCents > 0 && f.status === "pending" && <div className="small muted">{formatMoney(f.paidCents)} já pago</div>}</td>
                <td data-label="Valor" className="num">{formatMoney(f.amountCents)}</td>
                <td data-label="Em aberto" className="num">{f.status === "canceled" ? "–" : formatMoney(f.balanceCents)}</td>
                <td>
                  {f.status === "pending" && (
                    <div className="row-actions">
                      <Link className="btn btn--small btn--primary" href={`/pagamentos/novo?aluno=${f.studentId}&mensalidade=${f.id}`}>Registrar pagamento</Link>
                      {f.paidCents === 0 && <>
                        <Link className="btn btn--small" href={`/mensalidades/${f.id}/editar?back=${encodeURIComponent(here)}`}>Editar</Link>
                        <form action={cancelFeeAction}>
                          <input type="hidden" name="id" value={f.id} /><input type="hidden" name="back" value={here} />
                          <ConfirmSubmit className="btn btn--small btn--ghost-danger" title="Cancelar mensalidade" confirmLabel="Cancelar mensalidade" message={`Cancelar a mensalidade ${f.reference} de ${f.studentName} (${formatMoney(f.amountCents)})? Ela deixa de ser cobrada, mas continua no histórico.`}>Cancelar</ConfirmSubmit>
                        </form>
                      </>}
                    </div>
                  )}
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination page={page} pages={pagesOf(summary.count)} total={summary.count} size={PAGE_SIZE} params={sp} path="/mensalidades" />
      </Card>
    </>
  );
}
