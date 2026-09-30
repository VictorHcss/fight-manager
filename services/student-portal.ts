/**
 * Área do aluno (perfil STUDENT): só leitura e só os próprios dados.
 * Toda consulta parte do vínculo em que students.user_id é a conta logada e o
 * status é "active". Não há como pedir dados de outro aluno pela URL.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, fees, modalities, payments, students } from "@/db/schema";
import { today } from "@/lib/dates";
import { NotFoundError } from "@/lib/errors";
import { displayFeeStatus } from "@/lib/fee-status";

export interface StudentContext {
  userId: string;
  role: "STUDENT";
}

export async function studentOverview(ctx: StudentContext, studentId: string) {
  const [me] = await db.select({
    id: students.id, academyId: students.academyId, academyName: academies.name, name: students.name, phone: students.phone,
    email: students.email, birthDate: students.birthDate, modality: modalities.name, joinedAt: students.joinedAt,
    monthlyFeeCents: students.monthlyFeeCents, dueDay: students.dueDay,
  }).from(students).innerJoin(academies, eq(academies.id, students.academyId)).leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(and(eq(students.id, studentId), eq(students.userId, ctx.userId), eq(students.status, "active"), eq(academies.active, true)));
  if (!me) throw new NotFoundError("Vínculo");

  const now = today();
  const myFees = (await db.select({
    id: fees.id, reference: fees.reference, dueDate: fees.dueDate, amountCents: fees.amountCents, status: fees.status,
    paidCents: sql<number>`coalesce((select sum(p.amount_cents) from payments p where p.fee_id = fees.id and p.status = 'paid'), 0)::int`,
  }).from(fees).where(and(eq(fees.studentId, me.id), eq(fees.academyId, me.academyId), sql`${fees.status} <> 'canceled'`)).orderBy(desc(fees.dueDate)).limit(24))
    .map((f) => ({ ...f, displayStatus: displayFeeStatus(f.status, f.dueDate, now), balanceCents: Math.max(0, f.amountCents - f.paidCents) }));

  const myPayments = await db.select({ id: payments.id, paidAt: payments.paidAt, amountCents: payments.amountCents, method: payments.method, status: payments.status, feeId: payments.feeId })
    .from(payments).where(and(eq(payments.studentId, me.id), eq(payments.academyId, me.academyId), eq(payments.status, "paid"))).orderBy(desc(payments.paidAt)).limit(24);

  const open = myFees.filter((f) => f.status === "pending");
  const situation = open.some((f) => f.displayStatus === "overdue") ? "overdue" : open.length ? "pending" : "ok";
  return { me, fees: myFees, payments: myPayments, situation: situation as "ok" | "pending" | "overdue", openCents: open.reduce((s, f) => s + f.balanceCents, 0) };
}
