/**
 * Tarefa diária (pode rodar de hora em hora sem problema: tudo aqui é idempotente).
 * Para cada academia ativa, no fuso dela:
 * 1. gera as mensalidades do mês para quem ainda não tem (se a academia ligou a geração automática);
 * 2. manda por e-mail o lembrete X dias antes do vencimento e o aviso no dia seguinte ao vencimento.
 * Cada lembrete é gravado em fee_reminders antes do envio: nunca sai duas vezes o mesmo aviso.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, feeReminders, fees, guardians, payments, studentGuardians, students } from "@/db/schema";
import { formatDate, formatReference, today } from "@/lib/dates";
import { sendSafely } from "@/lib/email";
import { formatMoney } from "@/lib/money";
import { pixPayload } from "@/lib/pix";
import { generateMonthlyFees } from "./fees";

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface DailyResult { academies: number; generated: number; reminders: number }

export async function runDailyJobs(baseUrl: string, now: Date = new Date()): Promise<DailyResult> {
  const list = await db.select().from(academies).where(eq(academies.active, true));
  const result: DailyResult = { academies: list.length, generated: 0, reminders: 0 };
  for (const academy of list) {
    const day = today(now, academy.timezone);
    if (academy.autoGenerateFees) result.generated += await autoGenerate(academy.id, day.slice(0, 7));
    result.reminders += await sendReminders(academy, day, baseUrl);
  }
  return result;
}

/** Só chama a geração (e só grava na auditoria) quando falta mensalidade para alguém. */
async function autoGenerate(academyId: string, reference: string): Promise<number> {
  const [missing] = await db.select({ n: sql<number>`count(*)::int` }).from(students)
    .where(and(eq(students.academyId, academyId), eq(students.status, "active"), sql`${students.monthlyFeeCents} is not null`,
      sql`not exists (select 1 from fees f where f.student_id = ${students.id} and f.reference = ${reference})`));
  if (!missing.n) return 0;
  const r = await generateMonthlyFees({ academyId, userId: null }, reference, { keepCanceled: true });
  return r.created;
}

type Academy = typeof academies.$inferSelect;

async function sendReminders(academy: Academy, day: string, baseUrl: string): Promise<number> {
  const targets: { kind: "before" | "overdue"; dueDate: string }[] = [];
  if (academy.reminderDaysBefore) targets.push({ kind: "before", dueDate: addDays(day, academy.reminderDaysBefore) });
  if (academy.overdueReminder) targets.push({ kind: "overdue", dueDate: addDays(day, -1) });
  let sent = 0;
  for (const t of targets) {
    const rows = await db.select({
      id: fees.id, reference: fees.reference, dueDate: fees.dueDate, amountCents: fees.amountCents,
      paidCents: sql<number>`coalesce((select sum(p.amount_cents) from ${payments} p where p.fee_id = fees.id and p.status = 'paid'), 0)::int`,
      studentId: students.id, studentName: students.name, studentEmail: students.email, hasAccount: sql<boolean>`${students.userId} is not null`,
    }).from(fees).innerJoin(students, eq(students.id, fees.studentId))
      .where(and(eq(fees.academyId, academy.id), eq(fees.status, "pending"), eq(fees.dueDate, t.dueDate), eq(students.status, "active"),
        sql`not exists (select 1 from fee_reminders r where r.fee_id = fees.id and r.kind = ${t.kind})`));
    if (!rows.length) continue;

    // contato de cobrança: responsável principal com e-mail, senão o próprio aluno
    const primary = await db.select({ studentId: studentGuardians.studentId, name: guardians.name, email: guardians.email })
      .from(studentGuardians).innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId))
      .where(and(inArray(studentGuardians.studentId, rows.map((r) => r.studentId)), eq(studentGuardians.isPrimary, true)));

    for (const f of rows) {
      const balance = Math.max(0, f.amountCents - f.paidCents);
      if (!balance) continue;
      const guardian = primary.find((g) => g.studentId === f.studentId && g.email);
      const to = guardian?.email ?? f.studentEmail;
      if (!to) continue;
      // grava antes de enviar: se duas execuções coincidirem, só uma consegue o registro
      const [claimed] = await db.insert(feeReminders).values({ feeId: f.id, kind: t.kind, sentTo: to }).onConflictDoNothing().returning({ id: feeReminders.id });
      if (!claimed) continue;
      const ok = await sendSafely(reminderEmail({ academy, to, recipient: guardian?.name ?? f.studentName, student: guardian ? f.studentName : null,
        kind: t.kind, reference: f.reference, dueDate: f.dueDate, balance, portal: f.hasAccount ? `${baseUrl}/aluno` : null }));
      if (ok) sent++;
      else await db.delete(feeReminders).where(eq(feeReminders.id, claimed.id)); // falhou: tenta de novo na próxima execução
    }
  }
  return sent;
}

export function reminderEmail(o: { academy: Academy; to: string; recipient: string; student: string | null; kind: "before" | "overdue"; reference: string; dueDate: string; balance: number; portal: string | null }) {
  const first = o.recipient.split(" ")[0];
  const of = o.student ? ` de ${o.student.split(" ")[0]}` : "";
  const pix = o.academy.pixKey ? pixPayload({ key: o.academy.pixKey, name: o.academy.name, city: o.academy.city, amountCents: o.balance, txid: `M${o.reference.replace("-", "")}` }) : null;
  const subject = o.kind === "before"
    ? `Mensalidade${of} vence em ${formatDate(o.dueDate)}: ${o.academy.name}`
    : `Mensalidade${of} em atraso: ${o.academy.name}`;
  const text = [
    `Olá, ${first}!`,
    "",
    o.kind === "before"
      ? `A mensalidade${of} de ${formatReference(o.reference)} na ${o.academy.name} vence em ${formatDate(o.dueDate)}. Valor em aberto: ${formatMoney(o.balance)}.`
      : `A mensalidade${of} de ${formatReference(o.reference)} na ${o.academy.name} venceu em ${formatDate(o.dueDate)} e consta em aberto: ${formatMoney(o.balance)}. Se você já pagou, desconsidere este aviso.`,
    ...(pix ? ["", "Para pagar por Pix, copie o código abaixo e cole no app do seu banco (Pix copia e cola):", pix] : []),
    ...(o.portal ? ["", `Veja suas mensalidades e recibos em: ${o.portal}`] : []),
    "",
    o.academy.phone ? `Dúvidas? Fale com a academia: ${o.academy.phone}.` : "Dúvidas? Fale com a recepção da academia.",
  ].join("\n");
  return { to: o.to, subject, text };
}
