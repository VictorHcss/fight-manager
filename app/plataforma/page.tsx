import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { emailProvider } from "@/lib/email";
import { listAcademiesOverview } from "@/services/users";
import { logout } from "../login/actions";
import { CreateAcademyForm, ResendAccessForm } from "./Forms";

export const metadata: Metadata = { title: "Plataforma" };
export const dynamic = "force-dynamic";

/**
 * Administrador da plataforma: cria academias (com o e-mail do responsável) e vê números
 * agregados. Por privacidade, nunca vê alunos, mensalidades nem pagamentos.
 */
export default async function PlatformPage() {
  const ctx = await requirePlatformAdmin();
  const list = await listAcademiesOverview(ctx);
  const active = list.filter((a) => a.active);
  const provider = emailProvider();
  return (
    <div className="plain-area">
      <AppHeader user={ctx.user.name} role="Plataforma" home="/plataforma" logout={logout} />
      <main className="content content--wide">
        <PageHeader title="Academias" description="Crie academias e acompanhe os números gerais. Por privacidade, este perfil não acessa alunos, mensalidades nem pagamentos." />
        <div className="stats stats--3">
          <Stat label="Academias ativas" value={active.length} hint={list.length > active.length ? `${list.length - active.length} suspensa(s)` : undefined} />
          <Stat label="Alunos ativos" value={active.reduce((t, a) => t + a.students, 0)} hint="Somando todas as academias" />
          <Stat label="Administradores" value={list.reduce((t, a) => t + a.admins, 0)} />
        </div>

        <Card title="Nova academia">
          <p className="small muted" style={{ marginTop: 0 }}>O responsável recebe por e-mail um link para criar a senha. Depois ele entra com esse e-mail, configura a academia e convida os alunos.</p>
          {provider === "console"
            ? <div className="alert alert--info">O envio de e-mails não está configurado: o link de acesso aparece aqui para você copiar e enviar. Para enviar automaticamente, veja docs/email.md.</div>
            : <p className="small muted">E-mails enviados por {provider === "smtp" ? "SMTP" : "Resend"}.</p>}
          <CreateAcademyForm />
        </Card>

        <Card title="Academias cadastradas">
          {list.length === 0 ? <Empty title="Nenhuma academia ainda" text="Crie a primeira no formulário acima." /> : (
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Academia</th><th>Responsável</th><th>Situação</th><th className="num">Alunos ativos</th><th className="num">Administradores</th><th>Criada em</th><th /></tr></thead>
              <tbody>{list.map((a) => (
                <tr key={a.id}>
                  <td className="primary"><strong>{a.name}</strong></td>
                  <td data-label="Responsável">{a.adminEmail ?? <span className="muted">sem administrador</span>}</td>
                  <td data-label="Situação"><Badge status={a.active ? "active" : "inactive"}>{a.active ? "Ativa" : "Suspensa"}</Badge></td>
                  <td data-label="Alunos ativos" className="num">{a.students}</td>
                  <td data-label="Administradores" className="num">{a.admins}</td>
                  <td data-label="Criada em">{formatDate(a.createdAt.toISOString().slice(0, 10))}</td>
                  <td>{a.adminEmail && a.active && <ResendAccessForm academyId={a.id} academyName={a.name} />}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          <p className="small muted" style={{ marginBottom: 0 }}>Suspender academias ainda é feito no banco (ver docs/roadmap.md).</p>
        </Card>
      </main>
    </div>
  );
}
