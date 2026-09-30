import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { fees, financialEntries, payments, students } from "@/db/schema";
import { DomainError, NotFoundError } from "@/lib/errors";
import { AUTO_CATEGORIES, PAYMENT_METHODS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import type { z } from "zod";
import type { paymentInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";
import { lockedFee, paidCents, recomputeFee } from "./fees";

type PaymentData = z.output<typeof paymentInput>;

/** Cria a entrada no financeiro de um pagamento confirmado (uma por pagamento: payment_id é único). */
async function createIncome(tx: Tx, ctx: AcademyContext, p: typeof payments.$inferSelect, studentName: string, feeReference: string | null) {
  await tx.insert(financialEntries).values({
    academyId: ctx.academyId, type: "income", category: p.feeId ? AUTO_CATEGORIES.fee : AUTO_CATEGORIES.loose,
    description: p.feeId ? `Mensalidade ${feeReference} – ${studentName}` : `Pagamento – ${studentName}${p.reference ? ` (${p.reference})` : ""}`,
    amountCents: p.amountCents, date: p.paidAt, paymentId: p.id, createdBy: ctx.userId,
  });
}

export async function createPayment(ctx: AcademyContext, data: PaymentData) {
  return db.transaction(async (tx) => {
    const [student] = await tx.select().from(students).where(and(eq(students.id, data.studentId), eq(students.academyId, ctx.academyId)));
    if (!student || student.status === "pending" || student.status === "rejected") throw new DomainError("Aluno não encontrado.", { studentId: "Aluno não encontrado." });

    let reference: string | null = null;
    if (data.feeId) {
      const fee = await lockedFee(tx, ctx, data.feeId);
      if (fee.studentId !== student.id) throw new DomainError("Esta mensalidade é de outro aluno.", { feeId: "Mensalidade de outro aluno." });
      if (fee.status !== "pending") throw new DomainError(fee.status === "paid" ? "Esta mensalidade já está paga." : "Esta mensalidade foi cancelada.", { feeId: "Mensalidade indisponível." });
      const balance = fee.amountCents - (await paidCents(tx, fee.id));
      if (data.amount > balance) {
        throw new DomainError(`O valor passa do saldo da mensalidade (${formatMoney(balance)}).`, { amount: `O saldo restante é ${formatMoney(balance)}.` });
      }
      reference = fee.reference;
    }

    const [payment] = await tx.insert(payments).values({
      academyId: ctx.academyId, studentId: student.id, feeId: data.feeId, amountCents: data.amount, paidAt: data.paidAt,
      method: data.method, status: data.status, reference: data.reference, notes: data.notes, createdBy: ctx.userId,
    }).returning();

    if (payment.status === "paid") await createIncome(tx, ctx, payment, student.name, reference);
    if (payment.feeId) await recomputeFee(tx, payment.feeId);
    await audit(tx, ctx, "payment.created", "payment", payment.id,
      `${payment.status === "paid" ? "Pagamento" : "Pagamento pendente"} de ${formatMoney(payment.amountCents)} de ${student.name} (${PAYMENT_METHODS[payment.method]})`,
      { feeId: payment.feeId, amountCents: payment.amountCents, status: payment.status });
    return payment;
  });
}

async function lockedPayment(tx: Tx, ctx: AcademyContext, id: string) {
  const [p] = await tx.select().from(payments).where(and(eq(payments.id, id), eq(payments.academyId, ctx.academyId))).for("update");
  if (!p) throw new NotFoundError("Pagamento");
  return p;
}

/** Pagamento pendente (ex.: combinado para depois) que foi recebido. */
export async function confirmPayment(ctx: AcademyContext, id: string) {
  return db.transaction(async (tx) => {
    const p = await lockedPayment(tx, ctx, id);
    if (p.status !== "pending") throw new DomainError("Só pagamentos pendentes podem ser confirmados.");
    let reference: string | null = null;
    if (p.feeId) {
      const fee = await lockedFee(tx, ctx, p.feeId);
      if (fee.status === "canceled") throw new DomainError("A mensalidade deste pagamento foi cancelada.");
      const balance = fee.amountCents - (await paidCents(tx, fee.id));
      if (p.amountCents > balance) throw new DomainError(`O valor passa do saldo da mensalidade (${formatMoney(balance)}).`);
      reference = fee.reference;
    }
    const [student] = await tx.select().from(students).where(eq(students.id, p.studentId));
    const [updated] = await tx.update(payments).set({ status: "paid" }).where(eq(payments.id, id)).returning();
    await createIncome(tx, ctx, updated, student.name, reference);
    if (p.feeId) await recomputeFee(tx, p.feeId);
    await audit(tx, ctx, "payment.confirmed", "payment", id, `Pagamento de ${formatMoney(p.amountCents)} de ${student.name} confirmado`);
    return updated;
  });
}

/**
 * Cancelar preserva o histórico: o pagamento fica "cancelado", a entrada do financeiro
 * também, e a mensalidade volta a pendente (ou aparece atrasada, se já venceu).
 */
export async function cancelPayment(ctx: AcademyContext, id: string, reason: string) {
  const why = reason.trim();
  if (why.length < 3) throw new DomainError("Informe o motivo do cancelamento.", { reason: "Informe o motivo." });
  return db.transaction(async (tx) => {
    const p = await lockedPayment(tx, ctx, id);
    if (p.status === "canceled") throw new DomainError("Este pagamento já foi cancelado.");
    if (p.feeId) await lockedFee(tx, ctx, p.feeId);
    const [updated] = await tx.update(payments).set({ status: "canceled", canceledAt: new Date(), cancelReason: why.slice(0, 200) }).where(eq(payments.id, id)).returning();
    await tx.update(financialEntries).set({ status: "canceled" }).where(eq(financialEntries.paymentId, id));
    if (p.feeId) await recomputeFee(tx, p.feeId);
    await audit(tx, ctx, "payment.canceled", "payment", id, `Pagamento de ${formatMoney(p.amountCents)} cancelado: ${why}`, { reason: why });
    return updated;
  });
}

export interface PaymentFilters { from?: string; to?: string; method?: keyof typeof PAYMENT_METHODS; q?: string; studentId?: string; status?: "paid" | "pending" | "canceled" }

function paymentConditions(ctx: AcademyContext, f: PaymentFilters) {
  return and(
    eq(payments.academyId, ctx.academyId),
    f.from ? gte(payments.paidAt, f.from) : undefined,
    f.to ? lte(payments.paidAt, f.to) : undefined,
    f.method ? eq(payments.method, f.method) : undefined,
    f.status ? eq(payments.status, f.status) : undefined,
    f.studentId ? eq(payments.studentId, f.studentId) : undefined,
    f.q ? ilike(students.name, `%${f.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );
}

export async function listPayments(ctx: AcademyContext, f: PaymentFilters = {}, limit = 200, offset = 0) {
  return db.select({
    id: payments.id, studentId: payments.studentId, studentName: students.name, feeId: payments.feeId, feeReference: fees.reference,
    amountCents: payments.amountCents, paidAt: payments.paidAt, method: payments.method, status: payments.status,
    reference: payments.reference, notes: payments.notes, cancelReason: payments.cancelReason,
  }).from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .leftJoin(fees, eq(fees.id, payments.feeId))
    .where(paymentConditions(ctx, f))
    .orderBy(desc(payments.paidAt), desc(payments.createdAt), desc(payments.id)).limit(limit).offset(offset);
}

/** Quantidade e total recebido do filtro inteiro, calculados no banco. */
export async function paymentsSummary(ctx: AcademyContext, f: PaymentFilters = {}) {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
    paidCents: sql<number>`coalesce(sum(${payments.amountCents}) filter (where ${payments.status} = 'paid'), 0)::bigint`,
  }).from(payments).innerJoin(students, eq(students.id, payments.studentId)).where(paymentConditions(ctx, f));
  return { count: row.count, paidCents: Number(row.paidCents) };
}
