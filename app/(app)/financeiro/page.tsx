import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit, FilterToggle } from "@/components/client";
import { Alert, Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { currentReference, formatDate, isValidDate, monthRange } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Pagination } from "@/components/Pagination";
import { offsetOf, PAGE_SIZE, pageFrom, pagesOf } from "@/lib/pagination";
import { countEntries, financeSummary, listEntries } from "@/services/finance";
import { cancelEntryAction } from "./actions";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAcademyAdmin();
  const sp = await searchParams;
  const month = monthRange(currentReference());
  const from = sp.de && isValidDate(sp.de) ? sp.de : month.from;
  const to = sp.ate && isValidDate(sp.ate) ? sp.ate : month.to;
  const type = sp.tipo === "income" || sp.tipo === "expense" ? sp.tipo : undefined;
  const page = pageFrom(sp.pagina);
  const [summary, entries, total] = await Promise.all([financeSummary(ctx, from, to), listEntries(ctx, { from, to, type }, PAGE_SIZE, offsetOf(page)), countEntries(ctx, { from, to, type })]);
  const here = `/financeiro?${new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "ok" && k !== "erro") as [string, string][])}`;

  return (
    <>
      <PageHeader title="Financeiro" description={`De ${formatDate(from)} a ${formatDate(to)}. Lançamentos cancelados não entram nos totais.`}
        actions={<><Link href="/financeiro/novo?tipo=income" className="btn">Nova entrada</Link><Link href="/financeiro/novo" className="btn btn--primary">Nova despesa</Link></>} />
      {sp.erro && <Alert tone="danger">{sp.erro}</Alert>}
      <form className="filters">
        <label>De<input name="de" type="date" defaultValue={from} /></label>
        <FilterToggle active={[sp.ate, type].filter(Boolean).length} />
        <div className="filters-more">
        <label>até<input name="ate" type="date" defaultValue={to} /></label>
        <label>Tipo<select key={String(type ?? "")} name="tipo" defaultValue={type ?? ""}><option value="">Entradas e saídas</option><option value="income">Entradas</option><option value="expense">Saídas</option></select></label>
          <button type="submit" className="btn">Filtrar</button>
        </div>
      </form>
      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Stat label="Entradas" value={formatMoney(summary.incomeCents)} tone="ok" />
        <Stat label="Saídas" value={formatMoney(summary.expenseCents)} tone="danger" />
        <Stat label="Saldo" value={formatMoney(summary.balanceCents)} tone={summary.balanceCents < 0 ? "danger" : "ok"} />
      </div>
      <Card title="Movimentações">
        {entries.length === 0 ? <Empty title="Nenhuma movimentação no período" text="Pagamentos registrados aparecem aqui automaticamente." /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{entries.map((e) => (
              <tr key={e.id} style={e.status === "canceled" ? { opacity: 0.55 } : undefined}>
                <td className="primary">{formatDate(e.date)}</td>
                <td data-label="Descrição">{e.description}{e.status === "canceled" && <div className="small muted">cancelado</div>}</td>
                <td data-label="Categoria">{e.category}{e.paymentId && <div className="small muted">automático</div>}</td>
                <td data-label="Tipo"><Badge status={e.type}>{e.type === "income" ? "Entrada" : "Saída"}</Badge></td>
                <td data-label="Valor" className="num">{e.type === "expense" ? "-" : ""}{formatMoney(e.amountCents)}</td>
                <td>{e.status === "active" && !e.paymentId && (
                  <div className="row-actions"><form action={cancelEntryAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="back" value={here} />
                    <ConfirmSubmit className="btn btn--small btn--ghost-danger" message={`Cancelar o lançamento "${e.description}"?`}>Cancelar</ConfirmSubmit></form></div>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination page={page} pages={pagesOf(total)} total={total} size={PAGE_SIZE} params={sp} path="/financeiro" />
      </Card>
    </>
  );
}
