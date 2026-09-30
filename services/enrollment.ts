/**
 * Entrada de alunos pelo convite:
 *   convite → cadastro da conta → vínculo "pending" → aprovação (ou recusa) pelo ACADEMY_ADMIN.
 * A conta (users) guarda os dados da pessoa; o vínculo (students) guarda os dados da academia.
 */
import { and, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, modalities, students, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { DomainError, NotFoundError, isUniqueViolation } from "@/lib/errors";
import { formatMoney } from "@/lib/money";
import type { z } from "zod";
import type { approvalInput, signupInput } from "@/lib/validation";
import { audit } from "./audit";
import type { AcademyContext } from "./context";
import { assertModality } from "./academy";
import { consentText } from "@/lib/consent";
import { consumeInvite } from "./invites";

const INVALID = "Este convite não é mais válido. Peça um novo código para a academia.";
const EMAIL_TAKEN = () => new DomainError("Já existe uma conta com este e-mail. Entre com ela para usar o convite.", { email: "E-mail já cadastrado." });


async function academyName(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], academyId: string) {
  const [a] = await tx.select({ name: academies.name }).from(academies).where(eq(academies.id, academyId));
  return a?.name ?? "academia";
}

/** Cadastro pelo convite: cria a conta STUDENT e o pedido de entrada na academia do convite. */
export async function signUpWithInvite(token: string, data: z.output<typeof signupInput>) {
  const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${data.email}`);
  if (taken) throw EMAIL_TAKEN();
  const passwordHash = await hashPassword(data.password);

  try {
  return await db.transaction(async (tx) => {
    const invite = await consumeInvite(tx, token);
    if (!invite) throw new DomainError(INVALID);
    const [user] = await tx.insert(users).values({ academyId: null, role: "STUDENT", name: data.name, email: data.email, passwordHash }).returning({ id: users.id });
    const [student] = await tx.insert(students).values({
      academyId: invite.academyId, userId: user.id, inviteId: invite.id, status: "pending",
      name: data.name, phone: data.phone, email: data.email, birthDate: data.birthDate,
      dataConsentAt: new Date(), dataConsentText: consentText(await academyName(tx, invite.academyId)),
    }).returning({ id: students.id });
    await audit(tx, { userId: user.id, academyId: invite.academyId }, "enrollment.requested", "student", student.id, `${data.name} pediu para entrar pelo convite`);
    return { userId: user.id, studentId: student.id };
  });
  } catch (error) {
    if (isUniqueViolation(error)) throw EMAIL_TAKEN();
    throw error;
  }
}

/** Quem já tem conta (ex.: aluno de outra academia) pede para entrar em mais uma. */
export async function joinWithInvite(userId: string, token: string, consent: boolean) {
  if (!consent) throw new DomainError("É preciso concordar com o uso dos dados pela academia.");
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(and(eq(users.id, userId), eq(users.role, "STUDENT")));
    if (!user) throw new DomainError("Só contas de aluno podem usar convites.");
    const invite = await consumeInvite(tx, token);
    if (!invite) throw new DomainError(INVALID);
    const [already] = await tx.select({ id: students.id, status: students.status }).from(students)
      .where(and(eq(students.academyId, invite.academyId), eq(students.userId, userId)));
    if (already) throw new DomainError(already.status === "rejected" ? "Seu pedido para esta academia foi recusado. Fale com a recepção." : "Você já tem vínculo ou pedido nesta academia.");
    const [student] = await tx.insert(students).values({
      academyId: invite.academyId, userId, inviteId: invite.id, status: "pending", name: user.name, email: user.email,
      dataConsentAt: new Date(), dataConsentText: consentText(await academyName(tx, invite.academyId)),
    }).returning({ id: students.id });
    await audit(tx, { userId, academyId: invite.academyId }, "enrollment.requested", "student", student.id, `${user.name} pediu para entrar pelo convite`);
    return student;
  });
}

/**
 * Pedidos pendentes da academia, cada um com sugestões de alunos já cadastrados
 * (sem conta) que parecem ser a mesma pessoa: mesmo e-mail ou mesmo telefone.
 */
export async function listRequests(ctx: AcademyContext) {
  const pending = await db.select().from(students)
    .where(and(eq(students.academyId, ctx.academyId), eq(students.status, "pending"))).orderBy(students.createdAt);
  if (!pending.length) return [];

  const emails = pending.map((p) => p.email?.toLowerCase()).filter(Boolean) as string[];
  const phones = pending.map((p) => p.phone?.replace(/\D/g, "")).filter((p): p is string => !!p && p.length >= 8);
  const candidates = await db.select({ id: students.id, name: students.name, email: students.email, phone: students.phone, modality: modalities.name, status: students.status })
    .from(students).leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(and(
      eq(students.academyId, ctx.academyId), isNull(students.userId), inArray(students.status, ["active", "inactive", "suspended"]),
      or(
        emails.length ? inArray(sql`lower(${students.email})`, emails) : undefined,
        phones.length ? inArray(sql`regexp_replace(coalesce(${students.phone}, ''), '\\D', '', 'g')`, phones) : undefined,
      ),
    ));

  return pending.map((p) => ({
    ...p,
    matches: candidates.filter((c) =>
      (p.email && c.email && c.email.toLowerCase() === p.email.toLowerCase()) ||
      (p.phone && c.phone && c.phone.replace(/\D/g, "") === p.phone.replace(/\D/g, "") && c.phone.replace(/\D/g, "").length >= 8)),
  }));
}

export async function pendingRequestsCount(ctx: AcademyContext) {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(students).where(and(eq(students.academyId, ctx.academyId), eq(students.status, "pending")));
  return row.n;
}

async function lockedRequest(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], ctx: AcademyContext, id: string) {
  const [request] = await tx.select().from(students).where(and(eq(students.id, id), eq(students.academyId, ctx.academyId))).for("update");
  if (!request) throw new NotFoundError("Pedido");
  if (request.status !== "pending") throw new DomainError("Este pedido já foi analisado.");
  return request;
}

/** Aprovar = completar os dados da academia (modalidade, início, mensalidade) e ativar. */
export async function approveRequest(ctx: AcademyContext, id: string, data: z.output<typeof approvalInput>) {
  const modality = await assertModality(ctx, data.modalityId);
  return db.transaction(async (tx) => {
    const request = await lockedRequest(tx, ctx, id);
    const [student] = await tx.update(students).set({
      status: "active", modalityId: modality.id, joinedAt: data.joinedAt, monthlyFeeCents: data.monthlyFee, dueDay: data.dueDay,
      notes: data.notes, decidedAt: new Date(), decidedBy: ctx.userId,
    }).where(eq(students.id, request.id)).returning();
    await audit(tx, ctx, "enrollment.approved", "student", id, `Entrada de ${student.name} aprovada (${modality.name}, ${formatMoney(data.monthlyFee)})`);
    return student;
  });
}

/**
 * A pessoa já era aluna (cadastrada pelo administrador, sem conta): liga a conta ao
 * cadastro existente, que mantém todo o histórico financeiro, e encerra o pedido.
 */
export async function approveByLinking(ctx: AcademyContext, requestId: string, existingId: string) {
  return db.transaction(async (tx) => {
    const request = await lockedRequest(tx, ctx, requestId);
    const [existing] = await tx.select().from(students)
      .where(and(eq(students.id, existingId), eq(students.academyId, ctx.academyId), isNull(students.userId), ne(students.status, "pending"), ne(students.status, "rejected"))).for("update");
    if (!existing) throw new DomainError("Escolha um aluno já cadastrado nesta academia e sem conta.");
    await tx.delete(students).where(eq(students.id, request.id)); // o pedido não tem mensalidades nem pagamentos
    const [linked] = await tx.update(students).set({
      userId: request.userId, inviteId: request.inviteId, decidedAt: new Date(), decidedBy: ctx.userId,
      email: existing.email ?? request.email, phone: existing.phone ?? request.phone, birthDate: existing.birthDate ?? request.birthDate,
    }).where(eq(students.id, existing.id)).returning();
    await audit(tx, ctx, "enrollment.linked", "student", existing.id, `Conta de ${request.name} vinculada ao cadastro existente de ${existing.name}`);
    return linked;
  });
}

/** Recusar mantém o registro (histórico) e mostra o aviso na área do aluno. */
export async function rejectRequest(ctx: AcademyContext, id: string, reason: string | null) {
  return db.transaction(async (tx) => {
    const request = await lockedRequest(tx, ctx, id);
    const now = new Date();
    await tx.update(students).set({ status: "rejected", rejectionReason: reason, decidedAt: now, decidedBy: ctx.userId, closedAt: now }).where(eq(students.id, request.id));
    await audit(tx, ctx, "enrollment.rejected", "student", id, `Pedido de entrada de ${request.name} recusado${reason ? `: ${reason}` : ""}`);
  });
}

/** Academias em que a conta tem vínculo ou pedido (para a área do aluno). */
export async function membershipsOf(userId: string) {
  return db.select({
    id: students.id, status: students.status, academyName: academies.name, rejectionReason: students.rejectionReason, createdAt: students.createdAt,
  }).from(students).innerJoin(academies, eq(academies.id, students.academyId))
    .where(and(eq(students.userId, userId), eq(academies.active, true))).orderBy(desc(students.createdAt));
}



/**
 * O administrador adiciona um aluno que já tem conta (criada em "Criar conta"), pelo e-mail da conta.
 * Cria um pedido pendente, como o do convite: em Solicitações o administrador aprova completando
 * modalidade e mensalidade, ou vincula a conta a um cadastro que já existia (mantém o histórico).
 * Não há busca aberta por contas: só o e-mail exato, informado pela própria pessoa.
 */
export async function addStudentByEmail(ctx: AcademyContext, emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(and(sql`lower(${users.email}) = ${email}`, eq(users.role, "STUDENT"), eq(users.active, true)));
    if (!user) {
      throw new DomainError("Nenhuma conta de aluno com este e-mail. Peça para a pessoa criar a conta em \"Criar conta\" (ou usar o QR Code do convite) e tente de novo.", { email: "Conta não encontrada." });
    }
    const [open] = await tx.select({ id: students.id, status: students.status }).from(students)
      .where(and(eq(students.academyId, ctx.academyId), eq(students.userId, user.id), isNull(students.closedAt)));
    if (open) {
      throw new DomainError(open.status === "pending" ? "Esta conta já tem um pedido pendente. Veja em Solicitações." : "Esta conta já é aluna desta academia.", { email: "Já adicionado." });
    }
    const [student] = await tx.insert(students).values({
      academyId: ctx.academyId, userId: user.id, status: "pending", name: user.name, email: user.email, phone: user.phone, birthDate: user.birthDate,
      dataConsentAt: user.dataConsentAt, dataConsentText: user.dataConsentText,
    }).returning({ id: students.id });
    await audit(tx, ctx, "enrollment.added", "student", student.id, `Conta de ${user.name} adicionada pela academia (aguardando aprovação)`);
    return { studentId: student.id, name: user.name };
  });
}
