import type { Metadata } from "next";
import Link from "next/link";
import { CancelPaymentButton, ConfirmSubmit, FilterToggle } from "@/components/client";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, isValidDate } from "@/lib/dates";
import { PAYMENT_METHODS, PAYMENT_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { Pagination } from "@/components/Pagination";
import { offsetOf, PAGE_SIZE, pageFrom, pagesOf } from "@/lib/pagination";
import { listPayments, paymentsSummary } from "@/services/payments";
import { cancelPaymentAction, confirmPaymentAction } from "./actions";

export const metadata: Metadata = { title: "Pagamentos" };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAcademyAdmin();
  const sp = await searchParams;
  const method = sp.forma && sp.forma in PAYMENT_METHODS ? (sp.forma as keyof typeof PAYMENT_METHODS) : undefined;
  const status = sp.status && sp.status in PAYMENT_STATUS ? (sp.status as keyof typeof PAYMENT_STATUS) : undefined;
  const from = sp.de && isValidDate(sp.de) ? sp.de : undefined;
  const to = sp.ate && isValidDate(sp.ate) ? sp.ate : undefined;
  const filters = { method, status, from, to, q: sp.q };
  const page = pageFrom(sp.pagina);
  // o total é do filtro inteiro, calculado no banco (não só desta página)
  const [list, summary] = await Promise.all([listPayments(ctx, filters, PAGE_SIZE, offsetOf(page)), paymentsSummary(ctx, filters)]);
  const here = `/pagamentos?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "ok" && k !== "erro") as [string, string][])}`;

  return (
    <>
      <PageHeader title="Pagamentos" actions={<Link href="/pagamentos/novo" className="btn btn--primary">Registrar pagamento</Link>} />
      {sp.erro && <Alert tone="danger">{sp.erro}</Alert>}
      <form className="filters" role="search">
        <label>Aluno<input name="q" type="search" defaultValue={sp.q} placeholder="Nome do aluno" /></label>
        <FilterToggle active={[method, status, from, to].filter(Boolean).length} />
        <div className="filters-more">
        <label>Forma<select key={String(method ?? "")} name="forma" defaultValue={method ?? ""}><option value="">Todas</option>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Status<select key={String(status ?? "")} name="status" defaultValue={status ?? ""}><option value="">Todos</option>{Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>De<input name="de" type="date" defaultValue={from} /></label>
        <label>até<input name="ate" type="date" defaultValue={to} /></label>
          <button type="submit" className="btn">Filtrar</button>
        </div>
      </form>
      <Card title={summary.count ? `${summary.count} pagamento(s), ${formatMoney(summary.paidCents)} recebidos` : undefined}>
        {list.length === 0 ? <Empty title="Nenhum pagamento encontrado" action={<Link href="/pagamentos/novo" className="btn btn--primary">Registrar pagamento</Link>} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Data</th><th>Aluno</th><th>Referência</th><th>Forma</th><th>Status</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id}>
                <td className="primary">{formatDate(p.paidAt)}</td>
                <td data-label="Aluno"><Link href={`/alunos/${p.studentId}?aba=pagamentos`}>{p.studentName}</Link></td>
                <td data-label="Referência">{p.feeReference ? `Mensalidade ${p.feeReference}` : p.reference ?? "Avulso"}</td>
                <td data-label="Forma">{PAYMENT_METHODS[p.method]}</td>
                <td data-label="Status"><Badge status={p.status}>{PAYMENT_STATUS[p.status]}</Badge>{p.cancelReason && <div className="small muted">{p.cancelReason}</div>}</td>
                <td data-label="Valor" className="num">{formatMoney(p.amountCents)}</td>
                <td><div className="row-actions">
                  {p.status !== "pending" && <Link href={`/pagamentos/${p.id}/recibo`} className="btn btn--small btn--ghost">Recibo</Link>}
                  {p.status === "pending" && (
                    <form action={confirmPaymentAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={here} />
                      <ConfirmSubmit className="btn btn--small" tone="primary" title="Confirmar recebimento" confirmLabel="Confirmar recebimento" message={`Confirmar que o pagamento de ${formatMoney(p.amountCents)} de ${p.studentName} foi recebido? Ele entra no financeiro.`}>Confirmar recebimento</ConfirmSubmit></form>
                  )}
                  {p.status !== "canceled" && <CancelPaymentButton action={cancelPaymentAction} paymentId={p.id} back={here} description={`o pagamento de ${formatMoney(p.amountCents)} de ${p.studentName}`} />}
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination page={page} pages={pagesOf(summary.count)} total={summary.count} size={PAGE_SIZE} params={sp} path="/pagamentos" />
      </Card>
    </>
  );
}
