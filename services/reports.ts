/**
 * Relatórios da academia, calculados no banco (somas por mês). Só leitura.
 * - Mensalidades por mês de referência: esperado, recebido, em aberto e quanto disso está atrasado.
 * - Recebimentos por modalidade e por forma de pagamento no período.
 * - Novos alunos por mês (pela data de início).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, modalities, payments, students } from "@/db/schema";
import { todayIn } from "@/lib/dates";
import type { AcademyContext } from "./context";

/** Últimos `count` meses terminando em `last` (YYYY-MM), do mais antigo para o mais recente. */
export function monthsUntil(last: string, count: number): string[] {
  const [y, m] = last.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

export async function academyReport(ctx: AcademyContext, months: number) {
  const now = todayIn(ctx.timezone);
  const refs = monthsUntil(now.slice(0, 7), months);
  const from = `${refs[0]}-01`;
  const to = now;

  const paid = sql<number>`coalesce((select sum(p.amount_cents) from ${payments} p where p.fee_id = fees.id and p.status = 'paid'), 0)`;
  const byMonth = await db.select({
    reference: fees.reference,
    count: sql<number>`count(*)::int`,
    expected: sql<number>`sum(${fees.amountCents})::bigint`,
    received: sql<number>`sum(least(${fees.amountCents}, ${paid}))::bigint`,
    overdue: sql<number>`coalesce(sum(greatest(0, ${fees.amountCents} - ${paid})) filter (where ${fees.status} = 'pending' and ${fees.dueDate} < ${now}), 0)::bigint`,
    overdueCount: sql<number>`(count(*) filter (where ${fees.status} = 'pending' and ${fees.dueDate} < ${now}))::int`,
  }).from(fees)
    .where(and(eq(fees.academyId, ctx.academyId), sql`${fees.status} <> 'canceled'`, gte(fees.reference, refs[0]), lte(fees.reference, refs.at(-1)!)))
    .groupBy(fees.reference);

  const paidIn = and(eq(payments.academyId, ctx.academyId), eq(payments.status, "paid"), gte(payments.paidAt, from), lte(payments.paidAt, to));
  const [byModality, byMethod, newStudents, [active]] = await Promise.all([
    db.select({ name: sql<string>`coalesce(${modalities.name}, 'Sem modalidade')`, cents: sql<number>`sum(${payments.amountCents})::bigint`, students: sql<number>`count(distinct ${payments.studentId})::int` })
      .from(payments).innerJoin(students, eq(students.id, payments.studentId)).leftJoin(modalities, eq(modalities.id, students.modalityId))
      .where(paidIn).groupBy(modalities.name),
    db.select({ method: payments.method, cents: sql<number>`sum(${payments.amountCents})::bigint`, count: sql<number>`count(*)::int` })
      .from(payments).where(paidIn).groupBy(payments.method),
    db.select({ month: sql<string>`to_char(${students.joinedAt}, 'YYYY-MM')`, n: sql<number>`count(*)::int` }).from(students)
      .where(and(eq(students.academyId, ctx.academyId), gte(students.joinedAt, from), lte(students.joinedAt, to), sql`${students.status} not in ('pending', 'rejected')`))
      .groupBy(sql`to_char(${students.joinedAt}, 'YYYY-MM')`),
    db.select({ n: sql<number>`count(*)::int` }).from(students).where(and(eq(students.academyId, ctx.academyId), eq(students.status, "active"))),
  ]);

  const months_ = refs.map((reference) => {
    const r = byMonth.find((b) => b.reference === reference);
    const expected = Number(r?.expected ?? 0), received = Number(r?.received ?? 0);
    return {
      reference, count: r?.count ?? 0, expectedCents: expected, receivedCents: received, openCents: Math.max(0, expected - received),
      overdueCents: Number(r?.overdue ?? 0), overdueCount: r?.overdueCount ?? 0, pct: expected ? Math.round((received / expected) * 100) : null,
      newStudents: newStudents.find((n) => n.month === reference)?.n ?? 0,
    };
  });
  const sum = (k: "expectedCents" | "receivedCents" | "overdueCents") => months_.reduce((t, m) => t + m[k], 0);
  return {
    from, to, months: months_,
    totals: { expectedCents: sum("expectedCents"), receivedCents: sum("receivedCents"), overdueCents: sum("overdueCents"), newStudents: months_.reduce((t, m) => t + m.newStudents, 0), active: active.n },
    byModality: byModality.map((m) => ({ ...m, cents: Number(m.cents) })).sort((a, b) => b.cents - a.cents),
    byMethod: byMethod.map((m) => ({ ...m, cents: Number(m.cents) })).sort((a, b) => b.cents - a.cents),
  };
}
