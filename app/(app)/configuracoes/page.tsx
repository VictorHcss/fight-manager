import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/client";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { centsToInput, formatMoney } from "@/lib/money";
import { getAcademy, listModalities } from "@/services/academy";
import { listAcademyUsers } from "@/services/users";
import { toggleModalityAction, toggleUserAction } from "./actions";
import { AcademyForm, ModalityForm, NewUserForm, PasswordForm, TermsForm } from "./Forms";

export const metadata: Metadata = { title: "Configurações" };
const TABS = [["academia", "Academia"], ["modalidades", "Modalidades"], ["ficha", "Ficha de matrícula"], ["acesso", "Acesso"]] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; aba?: string }> }) {
  const ctx = await requireAcademyAdmin();
  const { erro, aba = "academia" } = await searchParams;
  const [academy, mods, team] = await Promise.all([getAcademy(ctx), listModalities(ctx), listAcademyUsers(ctx)]);

  return (
    <>
      <PageHeader title="Configurações" description="Dados e estrutura da sua academia." />
      {erro && <Alert tone="danger">{erro}</Alert>}
      <nav className="tabs" aria-label="Seções das configurações">
        {TABS.map(([key, label]) => <Link key={key} href={`/configuracoes?aba=${key}`} aria-current={aba === key ? "page" : undefined} scroll={false}>{label}</Link>)}
      </nav>

      {aba === "academia" && (
        <Card title="Dados da academia">
          <p className="small muted" style={{ marginTop: 0 }}>Aparecem no cabeçalho da ficha de matrícula e nas mensagens de WhatsApp.</p>
          <AcademyForm initial={{ name: academy.name, document: academy.document, phone: academy.phone, email: academy.email, zip: academy.zip, street: academy.street, number: academy.number, complement: academy.complement, district: academy.district, city: academy.city, state: academy.state }} />
        </Card>
      )}

      {aba === "modalidades" && (
        <>
          <Card title="Nova modalidade">
            <p className="small muted" style={{ marginTop: 0 }}>O valor sugerido vem preenchido no cadastro do aluno e pode ser ajustado aluno a aluno.</p>
            <ModalityForm id={null} />
          </Card>
          <Card title="Modalidades da academia">
            {mods.length === 0 ? <Empty title="Nenhuma modalidade cadastrada" text="Cadastre as modalidades oferecidas para poder matricular alunos." /> : (
              <ul className="modality-list">
                {mods.map((m) => (
                  <li key={m.id} data-inactive={!m.active}>
                    <details>
                      <summary>
                        <strong>{m.name}</strong>
                        <span className="muted small">{m.defaultFeeCents ? formatMoney(m.defaultFeeCents) : "sem valor sugerido"}, {m.students} aluno(s) ativo(s)</span>
                        {!m.active && <Badge status="inactive">Desativada</Badge>}
                      </summary>
                      <ModalityForm id={m.id} initial={{ name: m.name, defaultFee: m.defaultFeeCents ? centsToInput(m.defaultFeeCents) : "" }} />
                      <form action={toggleModalityAction} style={{ marginTop: "0.6rem" }}>
                        <input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={String(!m.active)} />
                        <ConfirmSubmit className="btn btn--small btn--ghost" tone="primary" title={m.active ? "Desativar modalidade" : "Reativar modalidade"} confirmLabel={m.active ? "Desativar" : "Reativar"}
                          message={m.active ? `Desativar ${m.name}? Ela sai das opções de novos cadastros. Os ${m.students} aluno(s) atuais continuam nela e continuam recebendo mensalidades.` : `Reativar ${m.name}? Ela volta a aparecer nos cadastros.`}>
                          {m.active ? "Desativar" : "Reativar"}
                        </ConfirmSubmit>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      {aba === "ficha" && (
        <Card title="Termos da ficha de matrícula">
          <p className="small muted" style={{ marginTop: 0 }}>A ficha é impressa a partir do perfil do aluno, com os dados dele, os da academia e estes termos, seguidos das linhas de assinatura. Escreva as regras da sua academia.</p>
          <TermsForm initial={academy.enrollmentTerms ?? ""} />
        </Card>
      )}

      {aba === "acesso" && (
        <div className="grid grid--2">
          <Card title="Minha senha"><PasswordForm /></Card>
          <Card title="Administradores da academia">
            <p className="small muted" style={{ marginTop: 0 }}>Todos os administradores têm acesso completo aos dados desta academia.</p>
            <ul className="plain-list">
              {team.map((u) => (
                <li key={u.id}>
                  <div><strong>{u.name}</strong>{u.id === ctx.userId && " (você)"}<div className="small muted">{u.email}</div></div>
                  {u.id === ctx.userId ? <Badge status="active">Ativo</Badge> : (
                    <form action={toggleUserAction}>
                      <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={String(!u.active)} />
                      <ConfirmSubmit className={`btn btn--small ${u.active ? "btn--ghost-danger" : ""}`} title={u.active ? "Desativar acesso" : "Reativar acesso"} confirmLabel={u.active ? "Desativar" : "Reativar"}
                        message={u.active ? `Desativar o acesso de ${u.name}? Ele não conseguirá mais entrar.` : `Reativar o acesso de ${u.name}?`}>
                        {u.active ? "Desativar" : "Reativar"}
                      </ConfirmSubmit>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <div className="span-2" style={{ gridColumn: "1 / -1" }}><Card title="Novo administrador"><NewUserForm /></Card></div>
        </div>
      )}
    </>
  );
}
