import type { Metadata } from "next";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/dates";
import { Pagination } from "@/components/Pagination";
import { offsetOf, PAGE_SIZE, pageFrom, pagesOf } from "@/lib/pagination";
import { countAudit, listAudit } from "@/services/audit";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  const ctx = await requireAcademyAdmin("auditoria");
  const sp = await searchParams;
  const page = pageFrom(sp.pagina);
  const [logs, total] = await Promise.all([listAudit(ctx, PAGE_SIZE, offsetOf(page)), countAudit(ctx)]);
  return (
    <>
      <PageHeader title="Auditoria" description="Quem fez o quê e quando: pagamentos, cancelamentos, mensalidades, alunos e acessos. Os registros não podem ser editados." />
      <Card>
        {logs.length === 0 ? <Empty title="Nenhuma ação registrada ainda" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Quando</th><th>Quem</th><th>Ação</th></tr></thead>
            <tbody>{logs.map((l) => (
              <tr key={l.id}><td className="primary">{formatDateTime(l.createdAt)}</td><td data-label="Quem">{l.user ?? "Sistema"}</td><td data-label="Ação">{l.summary}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        <Pagination page={page} pages={pagesOf(total)} total={total} size={PAGE_SIZE} params={sp} path="/auditoria" />
      </Card>
    </>
  );
}
