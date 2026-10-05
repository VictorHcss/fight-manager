import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/client";
import { Alert, Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { centsToInput, formatMoney } from "@/lib/money";
import { getAcademy, listModalities } from "@/services/academy";
import { listAcademyUsers } from "@/services/users";
import { toggleModalityAction, toggleUserAction } from "./actions";
import { AcademyForm, ModalityForm, NewUserForm, PasswordForm, PermissionsForm, TermsForm } from "./Forms";
import { initials } from "@/lib/initials";
import { can, hasFullAccess, isPermission, PERMISSIONS } from "@/lib/permissions";

export const metadata: Metadata = { title: "Configurações" };
const TABS = [["academia", "Academia"], ["modalidades", "Modalidades"], ["ficha", "Ficha de matrícula"], ["acesso", "Equipe e acesso"]] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ erro?: string; aba?: string }> }) {
  const ctx = await requireAcademyAdmin();
  const sp = await searchParams;
  const erro = sp.erro;
  const settings = can(ctx.permissions, "configuracoes");
  const full = hasFullAccess(ctx.permissions);
  const tabs = TABS.filter(([key]) => key === "acesso" || settings);
  const aba = tabs.some(([key]) => key === sp.aba) ? sp.aba! : tabs[0][0];
  const [academy, mods, team] = await Promise.all([getAcademy(ctx), listModalities(ctx), full ? listAcademyUsers(ctx) : Promise.resolve([])]);

  return (
    <>
      <PageHeader title="Configurações" description={settings ? "Dados e estrutura da sua academia." : "Sua senha de acesso."} />
      {erro && <Alert tone="danger">{erro}</Alert>}
      <nav className="tabs" aria-label="Seções das configurações">
        {tabs.map(([key, label]) => <Link key={key} href={`/configuracoes?aba=${key}`} aria-current={aba === key ? "page" : undefined} scroll={false}>{label}</Link>)}
      </nav>

      {aba === "academia" && (
        <Card title="Dados da academia">
          <p className="small muted card-lead">Aparecem no cabeçalho da ficha de matrícula e nas mensagens de WhatsApp.</p>
          <AcademyForm initial={{ name: academy.name, document: academy.document, phone: academy.phone, email: academy.email, timezone: academy.timezone, pixKey: academy.pixKey, autoGenerateFees: String(academy.autoGenerateFees), overdueReminder: String(academy.overdueReminder), reminderDaysBefore: academy.reminderDaysBefore === null ? "0" : String(academy.reminderDaysBefore), zip: academy.zip, street: academy.street, number: academy.number, complement: academy.complement, district: academy.district, city: academy.city, state: academy.state }} />
        </Card>
      )}

      {aba === "modalidades" && (
        <>
          <Card title="Nova modalidade">
            <p className="small muted card-lead">O valor sugerido vem preenchido no cadastro do aluno e pode ser ajustado aluno a aluno.</p>
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
          <p className="small muted card-lead">A ficha é impressa a partir do perfil do aluno, com os dados dele, os da academia e estes termos, seguidos das linhas de assinatura. Escreva as regras da sua academia.</p>
          <TermsForm initial={academy.enrollmentTerms ?? ""} />
        </Card>
      )}

      {aba === "acesso" && (
        <div className="settings-access">
          <Card title="Minha senha"><PasswordForm /></Card>
          {full ? (
            <>
              <Card title={`Equipe (${team.filter((u) => u.active).length} ativa${team.filter((u) => u.active).length === 1 ? "" : "s"})`}>
                <p className="small muted card-lead">Quem tem <strong>acesso total</strong> vê tudo e gerencia a equipe. No acesso personalizado, a pessoa só vê as áreas marcadas; o resto some do menu.</p>
                <ul className="team-list">
                  {team.map((u) => {
                    const me = u.id === ctx.userId;
                    const perms = u.permissions?.filter(isPermission) ?? null;
                    return (
                      <li key={u.id} data-inactive={!u.active}>
                        <div className="team-head">
                          <span className="avatar" aria-hidden="true">{initials(u.name)}</span>
                          <div className="team-who"><strong>{u.name}{me && " (você)"}</strong><span className="small muted">{u.email}</span></div>
                          {!u.active ? <Badge status="inactive">Desativado</Badge> : perms === null ? <Badge status="active">Acesso total</Badge> : <Badge status="pending">Personalizado</Badge>}
                        </div>
                        {perms && <p className="team-perms">{perms.map((p) => <span key={p} className="chip">{PERMISSIONS[p].label}</span>)}</p>}
                        {!me && (
                          <div className="team-actions">
                            {u.active && (
                              <details className="team-edit" key={(perms ?? ["total"]).join()}>{/* key: fecha depois de salvar */}
                                <summary className="btn btn--small">Alterar acesso</summary>
                                <PermissionsForm id={u.id} initial={perms} />
                              </details>
                            )}
                            <form action={toggleUserAction}>
                              <input type="hidden" name="id" value={u.id} /><input type="hidden" name="active" value={String(!u.active)} />
                              <ConfirmSubmit className={`btn btn--small ${u.active ? "btn--ghost-danger" : ""}`} title={u.active ? "Desativar acesso" : "Reativar acesso"} confirmLabel={u.active ? "Desativar" : "Reativar"}
                                message={u.active ? `Desativar o acesso de ${u.name}? A pessoa sai de todos os aparelhos e não consegue mais entrar.` : `Reativar o acesso de ${u.name}?`}>
                                {u.active ? "Desativar" : "Reativar"}
                              </ConfirmSubmit>
                            </form>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
              <Card title="Adicionar pessoa à equipe"><NewUserForm /></Card>
            </>
          ) : (
            <Card title="Seu acesso">
              <p className="card-lead">Você tem acesso a: {ctx.permissions!.map((p) => PERMISSIONS[p].label).join(", ")}.</p>
              <p className="small muted card-note">Para mudar o que você pode fazer, fale com quem tem acesso total na academia.</p>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
