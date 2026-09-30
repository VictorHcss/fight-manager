import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { financialEntries } from "@/db/schema";
import { DomainError, NotFoundError } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import type { z } from "zod";
import type { entryInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

/** Lançamento manual (matrícula, outros recebimentos, despesas). Mensalidades entram sozinhas pelo pagamento. */
export async function createEntry(ctx: AcademyContext, data: z.output<typeof entryInput>) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.insert(financialEntries).values({
      academyId: ctx.academyId, type: data.type, category: data.category, description: data.description,
      amountCents: data.amount, date: data.date, notes: data.notes, createdBy: ctx.userId,
    }).returning();
    await audit(tx, ctx, "entry.created", "financial_entry", entry.id, `${data.type === "income" ? "Entrada" : "Saída"} de ${formatMoney(data.amount)}: ${data.description}`);
    return entry;
  });
}

export async function cancelEntry(ctx: AcademyContext, id: string) {
  return db.transaction(async (tx) => {
    const [entry] = await tx.select().from(financialEntries).where(and(eq(financialEntries.id, id), eq(financialEntries.academyId, ctx.academyId))).for("update");
    if (!entry) throw new NotFoundError("Lançamento");
    if (entry.paymentId) throw new DomainError("Esta entrada veio de um pagamento. Para desfazer, cancele o pagamento.");
    if (entry.status === "canceled") return entry;
    const [updated] = await tx.update(financialEntries).set({ status: "canceled" }).where(eq(financialEntries.id, id)).returning();
    await audit(tx, ctx, "entry.canceled", "financial_entry", id, `Lançamento cancelado: ${entry.description} (${formatMoney(entry.amountCents)})`);
    return updated;
  });
}

/** Totais do período. Soma em centavos no próprio banco (inteiros, sem arredondamento). */
export async function financeSummary(ctx: AcademyContext, from: string, to: string) {
  const [row] = await db.select({
    income: sql<number>`coalesce(sum(${financialEntries.amountCents}) filter (where ${financialEntries.type} = 'income'), 0)::bigint`,
    expense: sql<number>`coalesce(sum(${financialEntries.amountCents}) filter (where ${financialEntries.type} = 'expense'), 0)::bigint`,
  }).from(financialEntries)
    .where(and(eq(financialEntries.academyId, ctx.academyId), eq(financialEntries.status, "active"), gte(financialEntries.date, from), lte(financialEntries.date, to)));
  const income = Number(row.income);
  const expense = Number(row.expense);
  return { incomeCents: income, expenseCents: expense, balanceCents: income - expense };
}

type EntryFilters = { from: string; to: string; type?: "income" | "expense" };
const entryConditions = (ctx: AcademyContext, f: EntryFilters) =>
  and(eq(financialEntries.academyId, ctx.academyId), gte(financialEntries.date, f.from), lte(financialEntries.date, f.to), f.type ? eq(financialEntries.type, f.type) : undefined);

export async function listEntries(ctx: AcademyContext, f: EntryFilters, limit = 300, offset = 0) {
  return db.select().from(financialEntries).where(entryConditions(ctx, f))
    .orderBy(desc(financialEntries.date), desc(financialEntries.createdAt), desc(financialEntries.id)).limit(limit).offset(offset);
}

export async function countEntries(ctx: AcademyContext, f: EntryFilters) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(financialEntries).where(entryConditions(ctx, f));
  return row.n;
}
