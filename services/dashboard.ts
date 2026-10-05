import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { fees, payments, students } from "@/db/schema";
import { monthRange, todayIn } from "@/lib/dates";
import type { AcademyContext } from "./context";
import { financeSummary } from "./finance";
import { listFees } from "./fees";

export async function dashboard(ctx: AcademyContext, reference: string) {
  const now = todayIn(ctx.timezone);
  const { from, to } = monthRange(reference);
  const open = sql`${fees.amountCents} - coalesce((select sum(p.amount_cents) from ${payments} p where p.fee_id = fees.id and p.status = 'paid'), 0)`;

  // consultas independentes: rodam em paralelo (o Início abre mais rápido)
  const [[counts], [feeTotals], [paid], [month], overdue, upcoming, finance] = await Promise.all([
    db.select({
      active: sql<number>`count(*) filter (where ${students.status} = 'active')::int`,
      inactive: sql<number>`count(*) filter (where ${students.status} = 'inactive')::int`,
      requests: sql<number>`count(*) filter (where ${students.status} = 'pending')::int`,
    }).from(students).where(eq(students.academyId, ctx.academyId)),
    db.select({
      pendingCount: sql<number>`count(*) filter (where ${fees.dueDate} >= ${now})::int`,
      pendingCents: sql<number>`coalesce(sum(${open}) filter (where ${fees.dueDate} >= ${now}), 0)::bigint`,
      overdueCount: sql<number>`count(*) filter (where ${fees.dueDate} < ${now})::int`,
      overdueCents: sql<number>`coalesce(sum(${open}) filter (where ${fees.dueDate} < ${now}), 0)::bigint`,
    }).from(fees).where(and(eq(fees.academyId, ctx.academyId), eq(fees.status, "pending"))),
    db.select({ count: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::bigint` })
      .from(payments).where(and(eq(payments.academyId, ctx.academyId), eq(payments.status, "paid"), gte(payments.paidAt, from), lte(payments.paidAt, to))),
    // mensalidades do mês de referência: quanto era esperado e quanto delas já foi pago (em qualquer data)
    db.select({
      count: sql<number>`count(*)::int`,
      expectedCents: sql<number>`coalesce(sum(${fees.amountCents}), 0)::bigint`,
      receivedCents: sql<number>`coalesce(sum(least(${fees.amountCents}, coalesce((select sum(p.amount_cents) from ${payments} p where p.fee_id = fees.id and p.status = 'paid'), 0))), 0)::bigint`,
    }).from(fees).where(and(eq(fees.academyId, ctx.academyId), eq(fees.reference, reference), sql`${fees.status} <> 'canceled'`)),
    listFees(ctx, { status: "overdue" }, 8),
    listFees(ctx, { status: "pending", to }, 8),
    financeSummary(ctx, from, to),
  ]);

  return {
    students: counts,
    fees: { pendingCount: feeTotals.pendingCount, pendingCents: Number(feeTotals.pendingCents), overdueCount: feeTotals.overdueCount, overdueCents: Number(feeTotals.overdueCents) },
    payments: { count: paid.count, cents: Number(paid.cents) },
    month: { count: month.count, expectedCents: Number(month.expectedCents), receivedCents: Number(month.receivedCents) },
    finance,
    overdue,
    upcoming,
  };
}
