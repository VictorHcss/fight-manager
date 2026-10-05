import { and, asc, desc, eq, gte, ilike, lt, lte, ne, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { fees, payments, students } from "@/db/schema";
import { dueDateFor, todayIn } from "@/lib/dates";
import { DomainError, NotFoundError } from "@/lib/errors";
import { displayFeeStatus, type DisplayFeeStatus } from "@/lib/fee-status";
import { formatMoney } from "@/lib/money";
import type { z } from "zod";
import type { feeInput, feeUpdateInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

// Atenção: em subconsultas, a coluna de fora vai escrita como fees.id (e não ${fees.id}).
// Em consultas de uma tabela só, o Drizzle omite o nome da tabela e "id" apontaria para a tabela interna.
const paidSum = sql<number>`coalesce((select sum(p.amount_cents) from ${payments} p where p.fee_id = fees.id and p.status = 'paid'), 0)::int`;

/** Violação de unicidade no PostgreSQL (código 23505). O Drizzle guarda o erro original em "cause". */
function duplicateReference(error: unknown): boolean {
  const e = error as { code?: string; cause?: unknown } | null;
  return !!e && (e.code === "23505" || (e.cause !== undefined && duplicateReference(e.cause)));
}

export async function createFee(ctx: AcademyContext, data: z.output<typeof feeInput>) {
  const [student] = await db.select().from(students).where(and(eq(students.id, data.studentId), eq(students.academyId, ctx.academyId)));
  if (!student || student.status === "pending" || student.status === "rejected") throw new DomainError("Aluno não encontrado.", { studentId: "Aluno não encontrado." });
  try {
    return await db.transaction(async (tx) => {
      const [fee] = await tx.insert(fees).values({
        academyId: ctx.academyId, studentId: student.id, amountCents: data.amount, dueDate: data.dueDate, reference: data.reference, notes: data.notes,
      }).returning();
      await audit(tx, ctx, "fee.created", "fee", fee.id, `Mensalidade ${data.reference} de ${student.name}: ${formatMoney(data.amount)}`);
      return fee;
    });
  } catch (error) {
    if (duplicateReference(error)) throw new DomainError("Este aluno já tem uma mensalidade para esse período.", { reference: "Já existe mensalidade para esse período." });
    throw error;
  }
}

async function lockedFee(tx: Tx, ctx: AcademyContext, id: string) {
  // FOR UPDATE: dois pagamentos simultâneos na mesma mensalidade não passam do saldo
  const [fee] = await tx.select().from(fees).where(and(eq(fees.id, id), eq(fees.academyId, ctx.academyId))).for("update");
  if (!fee) throw new NotFoundError("Mensalidade");
  return fee;
}

async function paidCents(tx: Tx, feeId: string) {
  const [row] = await tx.select({ total: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` }).from(payments)
    .where(and(eq(payments.feeId, feeId), eq(payments.status, "paid")));
  return row.total;
}

/** Editar só enquanto nada foi pago: correções depois disso passam pelo cancelamento do pagamento. */
export async function updateFee(ctx: AcademyContext, id: string, data: z.output<typeof feeUpdateInput>) {
  try {
    return await db.transaction(async (tx) => {
      const fee = await lockedFee(tx, ctx, id);
      if (fee.status !== "pending") throw new DomainError(fee.status === "paid" ? "Mensalidade paga não pode ser editada. Cancele o pagamento primeiro." : "Mensalidade cancelada não pode ser editada.");
      if ((await paidCents(tx, id)) > 0) throw new DomainError("Esta mensalidade já recebeu pagamento. Cancele os pagamentos antes de editar.");
      const [updated] = await tx.update(fees).set({ amountCents: data.amount, dueDate: data.dueDate, reference: data.reference, notes: data.notes })
        .where(and(eq(fees.id, id), eq(fees.academyId, ctx.academyId))).returning();
      await audit(tx, ctx, "fee.updated", "fee", id, `Mensalidade ${updated.reference} alterada`, { before: { amount: fee.amountCents, dueDate: fee.dueDate }, after: { amount: updated.amountCents, dueDate: updated.dueDate } });
      return updated;
    });
  } catch (error) {
    if (duplicateReference(error)) throw new DomainError("Este aluno já tem uma mensalidade para esse período.", { reference: "Já existe mensalidade para esse período." });
    throw error;
  }
}

export async function cancelFee(ctx: AcademyContext, id: string) {
  return db.transaction(async (tx) => {
    const fee = await lockedFee(tx, ctx, id);
    if (fee.status === "canceled") return fee;
    const [active] = await tx.select({ n: sql<number>`count(*)::int` }).from(payments).where(and(eq(payments.feeId, id), ne(payments.status, "canceled")));
    if (active.n > 0) throw new DomainError("Cancele os pagamentos desta mensalidade antes de cancelá-la.");
    const [updated] = await tx.update(fees).set({ status: "canceled" }).where(eq(fees.id, id)).returning();
    await audit(tx, ctx, "fee.canceled", "fee", id, `Mensalidade ${fee.reference} cancelada`);
    return updated;
  });
}

/** Recalcula a situação da mensalidade a partir dos pagamentos (fonte da verdade). */
export async function recomputeFee(tx: Tx, feeId: string) {
  const [fee] = await tx.select().from(fees).where(eq(fees.id, feeId));
  if (!fee || fee.status === "canceled") return;
  const next = (await paidCents(tx, feeId)) >= fee.amountCents ? "paid" : "pending";
  if (next !== fee.status) await tx.update(fees).set({ status: next }).where(eq(fees.id, feeId));
}

export { lockedFee, paidCents };

export interface FeeFilters {
  status?: DisplayFeeStatus;
  from?: string; // vencimento a partir de
  to?: string;
  q?: string; // nome do aluno
  studentId?: string;
}

function feeConditions(ctx: AcademyContext, f: FeeFilters) {
  const now = todayIn(ctx.timezone);
  const statusFilter = {
    pending: and(eq(fees.status, "pending"), gte(fees.dueDate, now)),
    overdue: and(eq(fees.status, "pending"), lt(fees.dueDate, now)),
    paid: eq(fees.status, "paid"),
    canceled: eq(fees.status, "canceled"),
  };
  return and(
    eq(fees.academyId, ctx.academyId),
    f.status ? statusFilter[f.status] : undefined,
    f.from ? gte(fees.dueDate, f.from) : undefined,
    f.to ? lte(fees.dueDate, f.to) : undefined,
    f.studentId ? eq(fees.studentId, f.studentId) : undefined,
    f.q ? ilike(students.name, `%${f.q.replace(/[%_\\]/g, "\\$&")}%`) : undefined,
  );
}

export async function listFees(ctx: AcademyContext, f: FeeFilters = {}, limit = 200, offset = 0) {
  const now = todayIn(ctx.timezone);
  const rows = await db.select({
    id: fees.id, studentId: fees.studentId, studentName: students.name, studentPhone: students.phone, amountCents: fees.amountCents, dueDate: fees.dueDate,
    reference: fees.reference, status: fees.status, notes: fees.notes, paidCents: paidSum,
    // contato de cobrança: responsável principal, se houver
    guardianName: sql<string | null>`(select g.name from student_guardians sg join guardians g on g.id = sg.guardian_id where sg.student_id = students.id and sg.is_primary limit 1)`,
    guardianPhone: sql<string | null>`(select g.phone from student_guardians sg join guardians g on g.id = sg.guardian_id where sg.student_id = students.id and sg.is_primary limit 1)`,
  }).from(fees).innerJoin(students, eq(students.id, fees.studentId))
    .where(feeConditions(ctx, f))
    .orderBy(f.status === "paid" ? desc(fees.dueDate) : asc(fees.dueDate), asc(fees.id)).limit(limit).offset(offset);
  return rows.map((r) => ({ ...r, displayStatus: displayFeeStatus(r.status, r.dueDate, now), balanceCents: Math.max(0, r.amountCents - r.paidCents) }));
}

/** Total do filtro inteiro, calculado no banco (não só da página que aparece na tela). */
export async function feesSummary(ctx: AcademyContext, f: FeeFilters = {}) {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
    openCents: sql<number>`coalesce(sum(greatest(0, ${fees.amountCents} - ${paidSum})) filter (where ${fees.status} = 'pending'), 0)::bigint`,
  }).from(fees).innerJoin(students, eq(students.id, fees.studentId)).where(feeConditions(ctx, f));
  return { count: row.count, openCents: Number(row.openCents) };
}

export async function getFee(ctx: AcademyContext, id: string) {
  const [row] = await listFeesById(ctx, id);
  if (!row) throw new NotFoundError("Mensalidade");
  return row;
}

async function listFeesById(ctx: AcademyContext, id: string) {
  const now = todayIn(ctx.timezone);
  const rows = await db.select({
    id: fees.id, studentId: fees.studentId, studentName: students.name, amountCents: fees.amountCents, dueDate: fees.dueDate,
    reference: fees.reference, status: fees.status, notes: fees.notes, paidCents: paidSum,
  }).from(fees).innerJoin(students, eq(students.id, fees.studentId)).where(and(eq(fees.id, id), eq(fees.academyId, ctx.academyId)));
  return rows.map((r) => ({ ...r, displayStatus: displayFeeStatus(r.status, r.dueDate, now), balanceCents: Math.max(0, r.amountCents - r.paidCents) }));
}

/**
 * Gera as mensalidades de um período para todos os alunos ativos que ainda não têm.
 * Não é recorrência automática: só roda quando o administrador pede.
 */
/** userId null = gerado pela tarefa diária (aparece como "Sistema" na auditoria). */
export async function generateMonthlyFees(ctx: { academyId: string; userId: string | null }, reference: string, opts: { keepCanceled?: boolean } = {}) {
  return db.transaction(async (tx) => {
    const active = await tx.select().from(students).where(and(eq(students.academyId, ctx.academyId), eq(students.status, "active")));
    const existing = await tx.select({ studentId: fees.studentId }).from(fees)
      // na geração automática, mensalidade cancelada pela academia conta como "já existe" (não volta sozinha)
      .where(and(eq(fees.academyId, ctx.academyId), eq(fees.reference, reference), opts.keepCanceled ? undefined : ne(fees.status, "canceled")));
    const have = new Set(existing.map((e) => e.studentId));
    // alunos ativos sempre têm valor mensal (garantido por uma regra do banco)
    const toCreate = active.filter((s) => !have.has(s.id) && s.monthlyFeeCents !== null);
    if (toCreate.length) {
      await tx.insert(fees).values(toCreate.map((s) => ({
        academyId: ctx.academyId, studentId: s.id, amountCents: s.monthlyFeeCents as number, dueDate: dueDateFor(reference, s.dueDay), reference,
      })));
    }
    await audit(tx, ctx, "fee.generated", "fee", null, `${toCreate.length} mensalidade(s) geradas para ${reference}${ctx.userId ? "" : " (automático)"}`, { reference, created: toCreate.length, skipped: have.size });
    return { created: toCreate.length, skipped: active.length - toCreate.length };
  });
}
