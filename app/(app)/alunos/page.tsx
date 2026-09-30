import type { Metadata } from "next";
import Link from "next/link";
import { FilterToggle } from "@/components/client";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { STUDENT_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { Pagination } from "@/components/Pagination";
import { offsetOf, PAGE_SIZE, pageFrom, pagesOf } from "@/lib/pagination";
import { countStudents, listStudents } from "@/services/students";

export const metadata: Metadata = { title: "Alunos" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; pagina?: string }> }) {
  const ctx = await requireAcademyAdmin();
  const sp = await searchParams;
  const { q = "", status = "" } = sp;
  const st = status === "active" || status === "inactive" || status === "suspended" ? status : undefined;
  const page = pageFrom(sp.pagina);
  const [list, total] = await Promise.all([listStudents(ctx, { q, status: st }, PAGE_SIZE, offsetOf(page)), countStudents(ctx, { q, status: st })]);

  return (
    <>
      <PageHeader title="Alunos" description="Pesquise por nome, telefone ou e-mail." actions={<Link href="/alunos/novo" className="btn btn--primary">Novo aluno</Link>} />
      <form className="filters" role="search">
        <label>Pesquisar<input name="q" defaultValue={q} placeholder="Nome, telefone ou e-mail" type="search" /></label>
        <FilterToggle active={st ? 1 : 0} />
        <div className="filters-more">
        <label>Status<select key={String(status)} name="status" defaultValue={status}><option value="">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></label>
          <button type="submit" className="btn">Filtrar</button>
        </div>
      </form>
      <Card>
        {list.length === 0 ? (
          q || st
            ? <Empty title="Nenhum aluno encontrado" text="Confira a grafia ou limpe os filtros." action={<Link href="/alunos" className="btn">Limpar filtros</Link>} />
            : <Empty title="Nenhum aluno cadastrado ainda" text="Comece cadastrando os alunos da academia." action={<Link href="/alunos/novo" className="btn btn--primary">Cadastrar o primeiro aluno</Link>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Nome</th><th>Modalidade</th><th>Telefone</th><th>Status</th><th>Financeiro</th><th className="num">Mensalidade</th></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="primary"><Link href={`/alunos/${s.id}`}>{s.name}</Link>{s.hasAccount && <span className="badge badge--muted" style={{ marginLeft: "0.4rem" }}>com conta</span>}{s.guardian && <div className="small muted">responsável: {s.guardian}</div>}</td>
                    <td data-label="Modalidade">{s.modality}</td>
                    <td data-label="Telefone">{s.phone ?? "–"}</td>
                    <td data-label="Status"><Badge status={s.status}>{STUDENT_STATUS[s.status]}</Badge></td>
                    <td data-label="Financeiro">{s.overdue > 0 ? <Badge status="overdue">{s.overdue} atrasada{s.overdue > 1 ? "s" : ""}</Badge> : <span className="muted small">Em dia</span>}</td>
                    <td data-label="Mensalidade" className="num">{s.monthlyFeeCents === null ? "–" : formatMoney(s.monthlyFeeCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} pages={pagesOf(total)} total={total} size={PAGE_SIZE} params={sp} path="/alunos" />
          </div>
        )}
      </Card>
    </>
  );
}
