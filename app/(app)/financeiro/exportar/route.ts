import { db } from "@/db";
import { audit } from "@/services/audit";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { csvMoney, csvResponse, toCsv } from "@/lib/csv";
import { currentReferenceIn, formatDate, isValidDate, monthRange } from "@/lib/dates";
import { listEntries } from "@/services/finance";

const MAX_ROWS = 20_000;

/** Exporta as movimentações do período (mesmos filtros da tela). Saídas saem com valor negativo para somar direto. */
export async function GET(request: Request) {
  const ctx = await requireAcademyAdmin("financeiro");
  const sp = new URL(request.url).searchParams;
  const month = monthRange(currentReferenceIn(ctx.timezone));
  const de = sp.get("de"), ate = sp.get("ate"), tipo = sp.get("tipo");
  const from = de && isValidDate(de) ? de : month.from;
  const to = ate && isValidDate(ate) ? ate : month.to;
  const type = tipo === "income" || tipo === "expense" ? tipo : undefined;
  const rows = await listEntries(ctx, { from, to, type }, MAX_ROWS, 0);
  // exportação leva dados pessoais para fora do sistema: fica registrada (LGPD)
  await db.transaction((tx) => audit(tx, ctx, "finance.exported", "academy", ctx.academyId, `Financeiro exportado em CSV, de ${formatDate(from)} a ${formatDate(to)} (${rows.length} linha(s))`));
  const csv = toCsv(
    ["Data", "Tipo", "Categoria", "Descrição", "Valor (R$)", "Situação", "Origem", "Observações"],
    rows.map((e) => [
      formatDate(e.date), e.type === "income" ? "Entrada" : "Saída", e.category, e.description,
      csvMoney(e.type === "income" ? e.amountCents : -e.amountCents), e.status === "active" ? "Ativo" : "Cancelado",
      e.paymentId ? "Pagamento" : "Lançamento manual", e.notes,
    ]),
  );
  return csvResponse(`financeiro-${from}-a-${to}.csv`, csv);
}
