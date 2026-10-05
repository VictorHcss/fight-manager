import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmSubmit } from "@/components/client";
import { Alert, Badge, Card, Dl, Empty, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, formatDateTime, todayIn } from "@/lib/dates";
import { listModalities } from "@/services/academy";
import { listRequests } from "@/services/enrollment";
import { approveAction, linkAction, rejectAction } from "./actions";
import { AddByEmailForm } from "./AddByEmailForm";
import { ApproveForm } from "./ApproveForm";

export const metadata: Metadata = { title: "Solicitações de entrada" };

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const ctx = await requireAcademyAdmin("solicitacoes");
  const { erro } = await searchParams;
  const [requests, modalities] = await Promise.all([listRequests(ctx), listModalities(ctx, { activeOnly: true })]);

  return (
    <>
      <PageHeader title="Solicitações de entrada" description="Pedidos pelo convite e alunos com conta que você adicionou. Aprove completando os dados da academia." actions={<Link href="/convidar" className="btn">Ver QR Code do convite</Link>} />
      {erro && <Alert tone="danger">{erro}</Alert>}
      <Card title="Adicionar aluno que já tem conta"><AddByEmailForm /></Card>
      {requests.length === 0 && <Card><Empty title="Nenhuma solicitação pendente" text="Quando alguém pedir para entrar pelo QR Code, ou quando você adicionar uma conta, o pedido aparece aqui." action={<Link href="/convidar" className="btn btn--primary">Convidar alunos</Link>} /></Card>}
      {requests.map((r) => (
        <Card key={r.id} id={`pedido-${r.id}`} className="request" title={r.name} actions={<span className="small muted">{r.inviteId ? "pedido pelo convite" : "adicionado pela academia"} em {formatDateTime(r.createdAt)}</span>}>
          <Dl items={[["Telefone", r.phone], ["E-mail", <span key="e" className="email-status">{r.email}{r.userId && (r.emailVerified ? <Badge status="active">confirmado</Badge> : <Badge status="pending">não confirmado</Badge>)}</span>], ["Nascimento", formatDate(r.birthDate)]]} />
          {r.userId && !r.emailVerified && <p className="small muted card-lead">A pessoa ainda não abriu o link de confirmação enviado para esse e-mail. Confira a identidade antes de aprovar.</p>}

          {r.matches.length > 0 && (
            <div className="match">
              <strong>Esta pessoa parece já estar cadastrada</strong>
              <p className="small" style={{ margin: "0.2rem 0 0.6rem" }}>Vincular a conta ao cadastro existente mantém mensalidades e pagamentos em um só lugar e evita aluno duplicado.</p>
              {r.matches.map((m) => (
                <form key={m.id} action={linkAction} className="inline-form" style={{ marginBottom: "0.4rem" }}>
                  <input type="hidden" name="id" value={r.id} /><input type="hidden" name="existing" value={m.id} />
                  <span className="small"><strong>{m.name}</strong>, {m.modality}, {m.email ?? m.phone}</span>
                  <ConfirmSubmit className="btn btn--small btn--primary" tone="primary" title="Vincular ao aluno existente" confirmLabel="Vincular" message={`Vincular a conta de ${r.name} ao cadastro de ${m.name}? Mensalidades e pagamentos de ${m.name} passam a aparecer na área dessa conta.`}>Vincular a este aluno</ConfirmSubmit>
                </form>
              ))}
            </div>
          )}

          <details className="approve" open={r.matches.length === 0}>
            <summary>{r.matches.length ? "Não é a mesma pessoa: aprovar como novo aluno" : "Aprovar e completar os dados da academia"}</summary>
            <ApproveForm action={approveAction.bind(null, r.id)} today={todayIn(ctx.timezone)} id={r.id} modalities={modalities} />
          </details>

          <form action={rejectAction} className="inline-form" style={{ marginTop: "0.9rem" }}>
            <input type="hidden" name="id" value={r.id} />
            <input name="reason" maxLength={200} placeholder="Motivo da recusa (opcional, o aluno verá)" aria-label="Motivo da recusa" style={{ flex: 1, minWidth: 200 }} />
            <ConfirmSubmit title="Recusar pedido" confirmLabel="Recusar pedido" message={`Recusar o pedido de ${r.name}? O pedido fica no histórico e a pessoa verá o aviso na área dela.`} className="btn btn--small btn--ghost-danger">Recusar</ConfirmSubmit>
          </form>
        </Card>
      ))}
    </>
  );
}
