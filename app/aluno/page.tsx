import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Flash } from "@/components/client";
import { Alert, Badge, Card, Dl, Empty } from "@/components/ui";
import { requireStudent } from "@/lib/auth/guards";
import { formatDate, formatDateTime } from "@/lib/dates";
import { FEE_STATUS_LABEL } from "@/lib/fee-status";
import { PAYMENT_METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { membershipsOf } from "@/services/enrollment";
import { studentOverview, type StudentContext } from "@/services/student-portal";
import { AppHeader } from "@/components/AppHeader";
import { logout } from "../login/actions";

export const metadata: Metadata = { title: "Minha área" };
export const dynamic = "force-dynamic";



/** Área do aluno: só leitura e só os próprios dados. */
export default async function StudentArea({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const ctx = await requireStudent();
  const { erro } = await searchParams;
  const memberships = await membershipsOf(ctx.userId);

  return (
    <div className="student-area">
      <AppHeader user={ctx.user.name} role="Área do aluno" home="/aluno" logout={logout} />
      <main className="content content--narrow">
        <Suspense fallback={null}><Flash /></Suspense>
        <h1 className="greeting">Olá, {ctx.user.name.split(" ")[0]}</h1>
        {erro && <Alert tone="danger">{erro}</Alert>}
        
        {memberships.length === 0 && (
          <Card className="no-academy">
            <h2>Sua conta ainda não está em uma academia</h2>
            <p>Passe o e-mail da sua conta para a recepção da academia. Quando ela adicionar você, suas mensalidades e pagamentos aparecem aqui.</p>
            <p className="no-academy-email"><span>E-mail da sua conta</span><strong>{ctx.user.email}</strong></p>
            <p className="small muted" style={{ marginBottom: 0 }}>Tem o QR Code ou o código da academia? <Link href="/criar-conta?tipo=convite">Use o convite</Link> e o pedido chega direto para a recepção.</p>
          </Card>
        )}
        {memberships.map((m) => (
          m.status === "active" ? <Membership key={m.id} ctx={ctx} id={m.id} /> : (
            <Card key={m.id} title={m.academyName}>
              {m.status === "pending" && <Alert tone="info">Seu cadastro na {m.academyName} está em análise desde {formatDateTime(m.createdAt)}. Quando a recepção aprovar, suas mensalidades e pagamentos aparecem aqui.</Alert>}
              {m.status === "rejected" && <Alert tone="danger">Seu pedido para entrar na {m.academyName} não foi aprovado.{m.rejectionReason && ` Motivo: ${m.rejectionReason}.`} Em caso de dúvida, fale com a recepção.</Alert>}
              {(m.status === "inactive" || m.status === "suspended") && <p className="muted" style={{ margin: 0 }}>Seu vínculo com esta academia está {m.status === "inactive" ? "inativo" : "suspenso"}. Fale com a recepção.</p>}
            </Card>
          )
        ))}
        <p className="small muted student-foot"><a href="/aluno/meus-dados" download>Baixar meus dados</a>: tudo o que as academias guardam sobre você, em um arquivo.</p>
      </main>
    </div>
  );
}

async function Membership({ ctx, id }: { ctx: StudentContext; id: string }) {
  const { me, fees, payments, situation, openCents } = await studentOverview(ctx, id);
  const open = fees.filter((f) => f.status === "pending").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = open.filter((f) => f.displayStatus === "overdue");
  const next = open[0];
  const lastPayment = payments[0];

  return (
    <>
      <p className="muted small" style={{ margin: "0 0 0.5rem" }}>{me.academyName}{me.modality ? `, ${me.modality}` : ""}</p>

      {/* 1. Estou em dia? */}
      <section className={`hero hero--${situation}`} aria-label="Situação">
        <span className="hero-label">Sua situação</span>
        <strong className="hero-title">{situation === "overdue" ? "Você tem mensalidade atrasada" : "Você está em dia"}</strong>
        <span>{situation === "overdue"
          ? `${overdue.length} mensalidade${overdue.length > 1 ? "s" : ""} atrasada${overdue.length > 1 ? "s" : ""}, ${formatMoney(overdue.reduce((t, f) => t + f.balanceCents, 0))} em aberto.`
          : lastPayment ? `Último pagamento em ${formatDate(lastPayment.paidAt)}, ${formatMoney(lastPayment.amountCents)}.` : "Nenhuma mensalidade atrasada."}</span>
      </section>

      {/* 2. Quanto e quando preciso pagar? */}
      <Card title="Próximo pagamento">
        {next ? (
          <div className="next-payment">
            <div><span className="stat-label">Valor</span><strong>{formatMoney(next.balanceCents)}</strong></div>
            <div><span className="stat-label">{next.displayStatus === "overdue" ? "Venceu em" : "Vence em"}</span><strong className={next.displayStatus === "overdue" ? "tone-danger" : undefined}>{formatDate(next.dueDate)}</strong></div>
            <div><span className="stat-label">Referência</span><strong>{next.reference}</strong></div>
          </div>
        ) : (
          <p style={{ margin: 0 }}>Nenhuma mensalidade em aberto no momento.{me.monthlyFeeCents !== null && ` Sua mensalidade é de ${formatMoney(me.monthlyFeeCents)}, com vencimento todo dia ${me.dueDay}.`}</p>
        )}
        {open.length > 1 && <p className="small muted" style={{ marginBottom: 0 }}>Total em aberto: {formatMoney(openCents)} em {open.length} mensalidades.</p>}
        <p className="small muted" style={{ marginBottom: 0 }}>O pagamento é feito na academia. Depois de registrado pela recepção, ele aparece aqui.</p>
      </Card>

      <Card title="Mensalidades">
        {fees.length === 0 ? <Empty title="Nenhuma mensalidade ainda" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Referência</th><th>Vencimento</th><th>Situação</th><th className="num">Valor</th><th className="num">Em aberto</th></tr></thead>
            <tbody>{fees.map((f) => (
              <tr key={f.id}>
                <td className="primary">{f.reference}</td>
                <td data-label="Vencimento">{formatDate(f.dueDate)}</td>
                <td data-label="Situação"><Badge status={f.displayStatus}>{FEE_STATUS_LABEL[f.displayStatus]}</Badge></td>
                <td data-label="Valor" className="num">{formatMoney(f.amountCents)}</td>
                <td data-label="Em aberto" className="num">{formatMoney(f.balanceCents)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Card title="Pagamentos">
        {payments.length === 0 ? <Empty title="Nenhum pagamento registrado" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Data</th><th>Forma</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>{payments.map((p) => (
              <tr key={p.id}><td className="primary">{formatDate(p.paidAt)}</td><td data-label="Forma">{PAYMENT_METHODS[p.method]}</td><td data-label="Valor" className="num">{formatMoney(p.amountCents)}</td><td><div className="row-actions"><Link href={`/aluno/recibo/${p.id}`} className="btn btn--small btn--ghost">Recibo</Link></div></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <details className="card my-data">
        <summary>Meus dados</summary>
        <Dl items={[
          ["Modalidade", me.modality], ["Aluno desde", formatDate(me.joinedAt)],
          ["Mensalidade", me.monthlyFeeCents === null ? null : `${formatMoney(me.monthlyFeeCents)}, vence todo dia ${me.dueDay}`],
          ["Telefone", me.phone], ["E-mail", me.email], ["Nascimento", formatDate(me.birthDate)],
        ]} />
        <p className="small muted" style={{ marginBottom: 0 }}>Para corrigir algum dado, fale com a recepção da academia.</p>
      </details>
    </>
  );
}
