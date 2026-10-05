import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfirmSubmit, Flash } from "@/components/client";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { formatDate } from "@/lib/dates";
import { emailProvider } from "@/lib/email";
import { listAcademiesOverview } from "@/services/users";
import { logout } from "../login/actions";
import { toggleAcademyAction } from "./actions";
import { CreateAcademyForm, ResendAccessForm } from "./Forms";

export const metadata: Metadata = { title: "Plataforma" };
export const dynamic = "force-dynamic";

const SITUATIONS = { ativas: "Ativas", suspensas: "Suspensas" } as const;
const normalize = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * Administrador da plataforma: cria, suspende e reativa academias e vê números
 * agregados. Por privacidade, nunca vê alunos, mensalidades nem pagamentos.
 */
export default async function PlatformPage({ searchParams }: { searchParams: Promise<{ q?: string; situacao?: string }> }) {
  const ctx = await requirePlatformAdmin();
  const sp = await searchParams;
  const all = await listAcademiesOverview(ctx);
  const active = all.filter((a) => a.active);
  const suspended = all.length - active.length;
  const provider = emailProvider();

  // a lista da plataforma é pequena (uma linha por academia): o filtro roda aqui mesmo
  const q = sp.q?.trim() ?? "";
  const situacao = sp.situacao === "ativas" || sp.situacao === "suspensas" ? sp.situacao : undefined;
  const list = all.filter((a) =>
    (!situacao || (situacao === "ativas") === a.active)
    && (!q || normalize(`${a.name} ${a.adminEmail ?? ""}`).includes(normalize(q))));
  const withoutAdmin = active.filter((a) => !a.adminEmail).length;

  return (
    <div className="plain-area">
      <AppHeader user={ctx.user.name} role="Plataforma" home="/plataforma" logout={logout} />
      <main className="content content--wide">
        <Suspense fallback={null}><Flash /></Suspense>
        <PageHeader title="Academias" description="Crie, suspenda e reative academias. Por privacidade, este perfil não acessa alunos, mensalidades nem pagamentos." />

        <div className="stats">
          <Stat label="Academias ativas" value={active.length} hint={suspended ? `${suspended} suspensa(s)` : "Nenhuma suspensa"} />
          <Stat label="Alunos ativos" value={active.reduce((t, a) => t + a.students, 0)} hint="Somando as academias ativas" />
          <Stat label="Administradores" value={all.reduce((t, a) => t + a.admins, 0)} />
          <Stat label="Sem administrador" value={withoutAdmin} tone={withoutAdmin ? "warn" : "ok"} hint={withoutAdmin ? "Gere um novo acesso" : "Todas com responsável"} />
        </div>

        <details className="card create-academy" open={all.length === 0}>
          <summary><span>Nova academia</span><span className="small muted">O responsável recebe um link por e-mail</span></summary>
          <div className="create-academy-body">
            <p className="small muted">Depois de criar a senha pelo link, o responsável configura a academia e convida os alunos.</p>
            {provider === "console"
              ? <div className="alert alert--info">O envio de e-mails não está configurado: o link de acesso aparece aqui para você copiar e enviar. Para enviar automaticamente, veja docs/instalacao.md.</div>
              : <p className="small muted">E-mails enviados por {provider === "smtp" ? "SMTP" : "Resend"}.</p>}
            <CreateAcademyForm />
          </div>
        </details>

        <Card title={`Academias cadastradas${list.length !== all.length ? ` (${list.length} de ${all.length})` : ""}`}>
          {all.length > 0 && (
            <form className="filters filters--inline" role="search">
              <label>Pesquisar<input name="q" type="search" defaultValue={q} placeholder="Nome da academia ou e-mail" /></label>
              <label>Situação<select name="situacao" defaultValue={situacao ?? ""}><option value="">Todas</option>{Object.entries(SITUATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <button type="submit" className="btn">Filtrar</button>
              {(q || situacao) && <Link href="/plataforma" className="btn btn--ghost">Limpar</Link>}
            </form>
          )}
          {all.length === 0 ? <Empty title="Nenhuma academia ainda" text="Crie a primeira em “Nova academia”." />
            : list.length === 0 ? <Empty title="Nenhuma academia encontrada" text="Tente outro nome ou limpe os filtros." /> : (
            <ul className="academy-list">
              {list.map((a) => (
                <li key={a.id} className={a.active ? undefined : "is-suspended"}>
                  <div className="academy-main">
                    <span className="avatar" aria-hidden="true">{a.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <strong>{a.name}</strong>
                      <span className="small muted">{a.adminEmail ?? "sem administrador ativo"}</span>
                    </div>
                    <Badge status={a.active ? "active" : "inactive"}>{a.active ? "Ativa" : "Suspensa"}</Badge>
                  </div>
                  <dl className="academy-numbers">
                    <div><dt>Alunos ativos</dt><dd>{a.students}</dd></div>
                    <div><dt>Administradores</dt><dd>{a.admins}</dd></div>
                    <div><dt>Criada em</dt><dd>{formatDate(a.createdAt.toISOString().slice(0, 10))}</dd></div>
                  </dl>
                  <div className="academy-actions">
                    {a.adminEmail && a.active && <ResendAccessForm academyId={a.id} academyName={a.name} />}
                    <form action={toggleAcademyAction}>
                      <input type="hidden" name="academyId" value={a.id} />
                      <input type="hidden" name="active" value={String(!a.active)} />
                      {a.active ? (
                        <ConfirmSubmit title="Suspender academia" confirmLabel="Suspender" className="btn btn--small btn--ghost-danger"
                          message={<>Ninguém da <strong>{a.name}</strong> conseguirá entrar, e os alunos deixam de ver os dados dela. Nada é apagado: você pode reativar depois.</>}>Suspender</ConfirmSubmit>
                      ) : (
                        <ConfirmSubmit title="Reativar academia" confirmLabel="Reativar" tone="primary" className="btn btn--small"
                          message={<>A <strong>{a.name}</strong> volta a funcionar normalmente, com todos os dados.</>}>Reativar</ConfirmSubmit>
                      )}
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
