import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptSheet } from "@/components/ReceiptSheet";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, formatReference } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { isUuid, orNotFound } from "@/lib/page";
import { whatsappLink } from "@/lib/whatsapp";
import { getReceipt } from "@/services/receipts";
import { PrintButton } from "../../../alunos/[id]/ficha/PrintButton";

export const metadata: Metadata = { title: "Recibo" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAcademyAdmin("pagamentos");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await orNotFound(getReceipt(ctx, id));
  const what = r.feeReference ? `a mensalidade de ${formatReference(r.feeReference)}${r.payerIsGuardian ? ` de ${r.studentName.split(" ")[0]}` : ""}` : r.reference ?? "o pagamento";
  const wa = r.status === "paid" ? whatsappLink(r.payer.phone, `Olá, ${r.payer.name.split(" ")[0]}! Aqui é da ${r.academy.name}. Confirmamos o recebimento de ${formatMoney(r.amountCents)} referente a ${what}, pago em ${formatDate(r.paidAt)}. Recibo nº ${r.number}. Obrigado!`) : null;
  return (
    <div className="sheet-page">
      <div className="sheet-toolbar no-print">
        <Link href={`/alunos/${r.studentId}?aba=pagamentos`} className="btn btn--ghost">← Voltar ao aluno</Link>
        {wa && <a href={wa} className="btn btn--whatsapp" target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a>}
        <PrintButton />
      </div>
      <ReceiptSheet r={r} />
    </div>
  );
}
