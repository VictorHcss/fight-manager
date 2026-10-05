import { db } from "@/db";
import { audit } from "@/services/audit";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { csvMoney, csvResponse, toCsv } from "@/lib/csv";
import { formatDate, isValidDate, todayIn } from "@/lib/dates";
import { FEE_STATUS_LABEL, type DisplayFeeStatus } from "@/lib/fee-status";
import { listFees } from "@/services/fees";

const STATUSES: DisplayFeeStatus[] = ["pending", "overdue", "paid", "canceled"];
const MAX_ROWS = 10_000;

/** Exporta as mensalidades com os mesmos filtros da tela (aluno, situação e vencimento). */
export async function GET(request: Request) {
  const ctx = await requireAcademyAdmin("mensalidades");
  const sp = new URL(request.url).searchParams;
  const status = STATUSES.find((s) => s === sp.get("status"));
  const de = sp.get("de"), ate = sp.get("ate");
  const filters = { status, from: de && isValidDate(de) ? de : undefined, to: ate && isValidDate(ate) ? ate : undefined, q: sp.get("q") || undefined };
  const rows = await listFees(ctx, filters, MAX_ROWS, 0);
  // exportação leva dados pessoais para fora do sistema: fica registrada (LGPD)
  await db.transaction((tx) => audit(tx, ctx, "fees.exported", "academy", ctx.academyId, `Mensalidades exportadas em CSV (${rows.length} linha(s))`));
  const csv = toCsv(
    ["Aluno", "Referência", "Vencimento", "Situação", "Valor (R$)", "Pago (R$)", "Em aberto (R$)", "Responsável", "Telefone de cobrança", "Observações"],
    rows.map((f) => [
      f.studentName, f.reference, formatDate(f.dueDate), FEE_STATUS_LABEL[f.displayStatus], csvMoney(f.amountCents), csvMoney(f.paidCents),
      f.status === "canceled" ? "" : csvMoney(f.balanceCents), f.guardianName, f.guardianPhone ?? f.studentPhone, f.notes,
    ]),
  );
  return csvResponse(`mensalidades-${todayIn(ctx.timezone)}.csv`, csv);
}
