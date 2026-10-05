/**
 * Presença: a equipe marca quem treinou no dia (uma presença por aluno por dia).
 * Serve para ver a frequência e achar quem sumiu antes de parar de pagar.
 */
import { and, asc, eq, gte, ilike, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendances, modalities, students } from "@/db/schema";
import { NotFoundError } from "@/lib/errors";
import { todayIn } from "@/lib/dates";
import { addDays } from "./automation";
import type { AcademyContext } from "./context";

/** Alunos ativos com a presença do dia, a última presença e quantas nos últimos 30 dias. */
export async function attendanceDay(ctx: AcademyContext, date: string, q?: string) {
  const since = addDays(date, -29);
  return db.select({
    id: students.id, name: students.name, modality: modalities.name,
    present: sql<boolean>`exists (select 1 from attendances a where a.student_id = ${students.id} and a.date = ${date})`,
    last: sql<string | null>`(select max(a.date)::text from attendances a where a.student_id = ${students.id})`,
    month: sql<number>`(select count(*)::int from attendances a where a.student_id = ${students.id} and a.date between ${since} and ${date})`,
  }).from(students).leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(and(eq(students.academyId, ctx.academyId), eq(students.status, "active"), q ? ilike(students.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`) : undefined))
    .orderBy(asc(students.name));
}

export async function setPresence(ctx: AcademyContext, studentId: string, date: string, present: boolean) {
  const [s] = await db.select({ id: students.id }).from(students)
    .where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId), eq(students.status, "active")));
  if (!s) throw new NotFoundError("Aluno");
  if (present) await db.insert(attendances).values({ academyId: ctx.academyId, studentId, date, createdBy: ctx.userId }).onConflictDoNothing();
  else await db.delete(attendances).where(and(eq(attendances.studentId, studentId), eq(attendances.date, date), eq(attendances.academyId, ctx.academyId)));
}

export async function presentCount(ctx: AcademyContext, date: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(attendances).where(and(eq(attendances.academyId, ctx.academyId), eq(attendances.date, date)));
  return r.n;
}

/**
 * Alunos ativos que não aparecem há `days` dias ou mais (ou nunca vieram desde que a academia
 * começou a marcar presença). Vazio enquanto a academia não usa a presença.
 */
export async function missingStudents(ctx: AcademyContext, days = 14) {
  const today = todayIn(ctx.timezone);
  const [{ first }] = await db.select({ first: sql<string | null>`min(${attendances.date})::text` }).from(attendances).where(eq(attendances.academyId, ctx.academyId));
  if (!first || first > addDays(today, -days)) return [];
  const limit = addDays(today, -days);
  const rows = await db.select({
    id: students.id, name: students.name, phone: students.phone,
    // consulta de uma tabela só: a coluna de fora vai escrita como students.id (ver a nota em services/fees.ts)
    last: sql<string | null>`(select max(a.date)::text from attendances a where a.student_id = students.id)`,
  }).from(students).where(and(eq(students.academyId, ctx.academyId), eq(students.status, "active")));
  return rows.filter((r) => !r.last || r.last <= limit).sort((a, b) => (a.last ?? "").localeCompare(b.last ?? ""));
}

/** Frequência de um aluno (perfil do aluno e área do aluno). */
export async function frequencyOf(academyId: string, studentId: string, today: string) {
  const [r] = await db.select({
    month: sql<number>`(count(*) filter (where ${attendances.date} >= ${addDays(today, -29)}))::int`,
    last: sql<string | null>`max(${attendances.date})::text`,
  }).from(attendances).where(and(eq(attendances.academyId, academyId), eq(attendances.studentId, studentId), gte(attendances.date, addDays(today, -365))));
  return { last30: r?.month ?? 0, last: r?.last ?? null };
}
