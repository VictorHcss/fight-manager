import { formatAddress } from "./AddressFields";
import { BrandMark } from "./Brand";
import { formatDate, formatReference } from "@/lib/dates";
import { moneyInWords } from "@/lib/extenso";
import { PAYMENT_METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { Receipt } from "@/services/receipts";

/** Recibo para impressão. Não é documento fiscal. */
export function ReceiptSheet({ r }: { r: Receipt }) {
  const what = r.feeReference
    ? `mensalidade de ${formatReference(r.feeReference)}`
    : (r.reference ?? "pagamento avulso");
  return (
    <article
      className={`sheet receipt${r.status === "canceled" ? " is-canceled" : ""}`}
    >
      {r.status === "canceled" && (
        <div className="receipt-stamp" aria-label="Recibo cancelado">
          CANCELADO
        </div>
      )}
      <header className="sheet-head">
        <BrandMark size={34} />
        <div>
          <strong>{r.academy.name}</strong>
          <span>
            {[r.academy.document, r.academy.phone, r.academy.email]
              .filter(Boolean)
              .join(", ")}
          </span>
          <span>{formatAddress(r.academy)}</span>
        </div>
      </header>
      <div className="receipt-title">
        <h1>Recibo</h1>
        <span>Nº {r.number}</span>
        <strong>{formatMoney(r.amountCents)}</strong>
      </div>
      <p className="receipt-body">
        Recebemos de <strong>{r.payer.name}</strong>
        {r.payer.cpf ? `, CPF ${r.payer.cpf},` : ""} a quantia de{" "}
        <strong>{formatMoney(r.amountCents)}</strong> (
        {moneyInWords(r.amountCents)}), referente à {what}
        {r.payerIsGuardian ? (
          <>
            {" "}
            do(a) aluno(a) <strong>{r.studentName}</strong>
          </>
        ) : (
          ""
        )}
        , paga em {formatDate(r.paidAt)} por{" "}
        {PAYMENT_METHODS[r.method].toLowerCase()}.
      </p>
      {r.status === "canceled" && (
        <p className="receipt-canceled">
          Pagamento cancelado{r.cancelReason ? `: ${r.cancelReason}` : ""}. Este
          recibo não tem validade.
        </p>
      )}
      <p className="sheet-date">
        {r.academy.city ?? "________________"}, {formatDate(r.paidAt)}.
      </p>
      <div className="sheet-signs" style={{ gridTemplateColumns: "1fr" }}>
        <div style={{ maxWidth: 320, margin: "0 auto" }}>
          <span />
          {r.academy.name}
        </div>
      </div>
      <p className="receipt-note">Recibo simples, sem valor fiscal.</p>
    </article>
  );
}
