import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { auditLogs, fees, payments, users } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import type { AcademyContext } from "./context";

/** Registra uma ação importante. Roda dentro da mesma transação da ação: ou grava os dois, ou nenhum. */
export async function audit(tx: Tx, ctx: { userId: string | null; academyId: string | null }, action: string, entity: string, entityId: string | null, summary: string, data?: Record<string, unknown>) {
  await tx.insert(auditLogs).values({ academyId: ctx.academyId, userId: ctx.userId, action, entity, entityId, summary, data: data ?? null });
}

export async function countAudit(ctx: AcademyContext) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(auditLogs).where(eq(auditLogs.academyId, ctx.academyId));
  return row.n;
}

export async function listAudit(ctx: AcademyContext, limit = 100, offset = 0) {
  return db.select({ id: auditLogs.id, action: auditLogs.action, summary: auditLogs.summary, createdAt: auditLogs.createdAt, user: users.name })
    .from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(eq(auditLogs.academyId, ctx.academyId)))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id)).limit(limit).offset(offset);
}

/** Histórico de um aluno: ações sobre ele, suas mensalidades e seus pagamentos. */
export async function listAuditFor(ctx: AcademyContext, studentId: string, limit = 50) {
  const feeIds = db.select({ id: fees.id }).from(fees).where(and(eq(fees.academyId, ctx.academyId), eq(fees.studentId, studentId)));
  const paymentIds = db.select({ id: payments.id }).from(payments).where(and(eq(payments.academyId, ctx.academyId), eq(payments.studentId, studentId)));
  const rows = await db.select({ id: auditLogs.id, summary: auditLogs.summary, createdAt: auditLogs.createdAt, user: users.name })
    .from(auditLogs).leftJoin(users, eq(users.id, auditLogs.userId))
    .where(and(eq(auditLogs.academyId, ctx.academyId), or(eq(auditLogs.entityId, studentId), inArray(auditLogs.entityId, feeIds), inArray(auditLogs.entityId, paymentIds))))
    .orderBy(desc(auditLogs.createdAt)).limit(limit);
  return rows.map((r) => ({ ...r, when: formatDateTime(r.createdAt) }));
}

