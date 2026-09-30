import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { ConfirmSubmit } from "@/components/client";
import { Card, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/dates";
import { siteUrl } from "@/lib/url";
import { pendingRequestsCount } from "@/services/enrollment";
import { currentInvite } from "@/services/invites";
import { regenerateInviteAction } from "./actions";
import { EmailInviteForm } from "./EmailInviteForm";
import { InviteTools } from "./InviteTools";

export const metadata: Metadata = { title: "Convidar alunos" };

export default async function InvitePage() {
  const ctx = await requireAcademyAdmin();
  const [invite, pending] = await Promise.all([currentInvite(ctx), pendingRequestsCount(ctx)]);
  const link = `${await siteUrl()}/convite/${invite.token}`;
  // o QR contém só o endereço com o código; nenhum dado da academia ou de pessoas
  const svg = await QRCode.toString(link, { type: "svg", margin: 1, width: 280, color: { dark: "#16181d", light: "#ffffff" } });
  const academy = ctx.user.academyName ?? "academia";

  return (
    <>
      <PageHeader title="Convidar alunos" description="O aluno escaneia o QR Code, cria a própria conta e o pedido chega para você aprovar." />
      {pending > 0 && <div className="alert alert--info no-print">{pending} pedido(s) esperando aprovação. <Link href="/solicitacoes">Ver solicitações</Link></div>}
      <div className="grid grid--side">
        <Card className="invite-poster">
          <p className="invite-eyebrow">Novo por aqui?</p>
          <h2 className="invite-title">Faça seu cadastro na {academy}</h2>
          <div className="invite-qr" role="img" aria-label="QR Code do convite" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="invite-hint">Aponte a câmera do celular para o código, crie sua conta e aguarde a aprovação da recepção.</p>
          <p className="invite-code">Código: <strong>{invite.token}</strong></p>
          <InviteTools link={link} academy={academy} />
        </Card>
        <div className="no-print">
          <Card title="Como funciona">
            <ol className="small" style={{ paddingLeft: "1.1rem", margin: 0, display: "grid", gap: "0.4rem" }}>
              <li>Mostre o QR na recepção, imprima o cartaz ou envie o link.</li>
              <li>O aluno informa nome, telefone, e-mail, nascimento e senha. O cadastro pelo convite é só para <strong>maiores de 18 anos</strong>; menores são cadastrados por você em Alunos.</li>
              <li>O pedido aparece em <Link href="/solicitacoes">Solicitações</Link>. Ao aprovar, você define modalidade, início e mensalidade.</li>
              <li>Depois da aprovação, o aluno acessa a área dele e vê as próprias mensalidades e pagamentos.</li>
            </ol>
          </Card>
          <Card title="Enviar convite por e-mail">
            <p className="small muted" style={{ marginTop: 0 }}>A pessoa recebe o link do convite e o pedido chega em Solicitações.</p>
            <EmailInviteForm />
            <p className="small muted" style={{ marginBottom: 0 }}>O aluno já criou a conta? <Link href="/solicitacoes">Adicione pelo e-mail em Solicitações</Link>.</p>
          </Card>
          <Card title="Segurança do código">
            <p className="small" style={{ marginTop: 0 }}>O código é aleatório e não contém dados da academia nem de pessoas. Qualquer pessoa com ele pode <strong>pedir</strong> para entrar, mas só entra quem você aprovar.</p>
            <p className="small muted">Gerado em {formatDateTime(invite.createdAt)}, usado {invite.usesCount} vez(es).</p>
            <form action={regenerateInviteAction}>
              <ConfirmSubmit className="btn btn--ghost-danger" title="Gerar novo código" confirmLabel="Gerar novo código" message="O QR Code atual, inclusive cartazes já impressos e links enviados, para de funcionar na hora. Pedidos que já chegaram continuam em Solicitações.">Gerar novo código</ConfirmSubmit>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
