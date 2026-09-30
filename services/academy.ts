/** Configuração da academia: dados, termos da ficha e modalidades. Sempre da academia do contexto. */
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, modalities, students } from "@/db/schema";
import { DomainError, NotFoundError } from "@/lib/errors";
import type { z } from "zod";
import type { academyInput, modalityInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";

export async function getAcademy(ctx: AcademyContext) {
  const [academy] = await db.select().from(academies).where(eq(academies.id, ctx.academyId));
  if (!academy) throw new NotFoundError("Academia");
  return academy;
}

export async function updateAcademy(ctx: AcademyContext, data: z.output<typeof academyInput>) {
  return db.transaction(async (tx) => {
    const [a] = await tx.update(academies).set(data).where(eq(academies.id, ctx.academyId)).returning();
    await audit(tx, ctx, "academy.updated", "academy", ctx.academyId, "Dados da academia atualizados");
    return a;
  });
}

export async function updateTerms(ctx: AcademyContext, terms: string) {
  const text = terms.trim().slice(0, 20000) || null;
  return db.transaction(async (tx) => {
    await tx.update(academies).set({ enrollmentTerms: text }).where(eq(academies.id, ctx.academyId));
    await audit(tx, ctx, "academy.terms", "academy", ctx.academyId, "Termos da ficha de matrícula atualizados");
  });
}

export async function listModalities(ctx: AcademyContext, { activeOnly = false } = {}) {
  return db.select({
    id: modalities.id, name: modalities.name, defaultFeeCents: modalities.defaultFeeCents, active: modalities.active,
    students: sql<number>`(select count(*)::int from students s where s.modality_id = modalities.id and s.status = 'active')`,
  }).from(modalities)
    .where(and(eq(modalities.academyId, ctx.academyId), activeOnly ? eq(modalities.active, true) : undefined))
    .orderBy(asc(modalities.name));
}

function duplicate(error: unknown): boolean {
  const e = error as { code?: string; cause?: unknown } | null;
  return !!e && (e.code === "23505" || (e.cause !== undefined && duplicate(e.cause)));
}

export async function createModality(ctx: AcademyContext, data: z.output<typeof modalityInput>) {
  try {
    return await db.transaction(async (tx) => {
      const [m] = await tx.insert(modalities).values({ academyId: ctx.academyId, name: data.name, defaultFeeCents: data.defaultFee }).returning();
      await audit(tx, ctx, "modality.created", "modality", m.id, `Modalidade criada: ${m.name}`);
      return m;
    });
  } catch (error) {
    if (duplicate(error)) throw new DomainError("Já existe uma modalidade com esse nome.", { name: "Já existe." });
    throw error;
  }
}

export async function updateModality(ctx: AcademyContext, id: string, data: z.output<typeof modalityInput>) {
  try {
    return await db.transaction(async (tx) => {
      const [m] = await tx.update(modalities).set({ name: data.name, defaultFeeCents: data.defaultFee })
        .where(and(eq(modalities.id, id), eq(modalities.academyId, ctx.academyId))).returning();
      if (!m) throw new NotFoundError("Modalidade");
      await audit(tx, ctx, "modality.updated", "modality", id, `Modalidade alterada: ${m.name}`);
      return m;
    });
  } catch (error) {
    if (duplicate(error)) throw new DomainError("Já existe uma modalidade com esse nome.", { name: "Já existe." });
    throw error;
  }
}

/** Modalidades não são apagadas (alunos antigos continuam ligados): só saem das listas de escolha. */
export async function setModalityActive(ctx: AcademyContext, id: string, active: boolean) {
  return db.transaction(async (tx) => {
    const [m] = await tx.update(modalities).set({ active }).where(and(eq(modalities.id, id), eq(modalities.academyId, ctx.academyId))).returning();
    if (!m) throw new NotFoundError("Modalidade");
    await audit(tx, ctx, active ? "modality.activated" : "modality.deactivated", "modality", id, `Modalidade ${m.name} ${active ? "reativada" : "desativada"}`);
    return m;
  });
}

/** Confere que a modalidade é desta academia (e ativa, para cadastros novos). */
export async function assertModality(ctx: AcademyContext, id: string, { allowInactive = false } = {}) {
  const [m] = await db.select().from(modalities).where(and(eq(modalities.id, id), eq(modalities.academyId, ctx.academyId)));
  if (!m || (!m.active && !allowInactive)) throw new DomainError("Escolha uma modalidade da academia.", { modalityId: "Modalidade inválida." });
  return m;
}

/** Primeira utilização: o que falta configurar (some do Início quando tudo estiver feito). */
export async function setupStatus(ctx: AcademyContext) {
  const a = await getAcademy(ctx);
  const [m] = await db.select({ n: sql<number>`count(*)::int` }).from(modalities).where(and(eq(modalities.academyId, ctx.academyId), eq(modalities.active, true)));
  const [missingBirth] = await db.select({ n: sql<number>`count(*)::int` }).from(students)
    .where(and(eq(students.academyId, ctx.academyId), eq(students.status, "active"), sql`${students.birthDate} is null`));
  const steps = [
    { key: "dados", label: "Dados da academia (telefone e endereço)", done: !!(a.phone && a.city), href: "/configuracoes?aba=academia" },
    { key: "modalidades", label: "Modalidades oferecidas", done: m.n > 0, href: "/configuracoes?aba=modalidades" },
    { key: "termos", label: "Termos da ficha de matrícula", done: !!a.enrollmentTerms, href: "/configuracoes?aba=ficha" },
  ];
  return { steps, complete: steps.every((s) => s.done), missingBirth: missingBirth.n };
}
