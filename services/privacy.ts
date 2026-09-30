/**
 * Direitos do titular (LGPD): exportar e eliminar dados pessoais.
 * Eliminar não apaga o financeiro (a academia precisa dele para a contabilidade):
 * os valores ficam, sem nada que identifique a pessoa.
 */
import { randomBytes } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, auditLogs, fees, financialEntries, guardians, modalities, passwordResets, payments, sessions, studentGuardians, students, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { DomainError, NotFoundError } from "@/lib/errors";
import { audit } from "./audit";
import type { AcademyContext } from "./context";
import type { StudentContext } from "./student-portal";

async function collect(studentId: string) {
  const [s] = await db.select({ student: students, modality: modalities.name, academy: academies.name }).from(students)
    .innerJoin(academies, eq(academies.id, students.academyId)).leftJoin(modalities, eq(modalities.id, students.modalityId))
    .where(eq(students.id, studentId));
  const g = await db.select({ guardian: guardians, relationship: studentGuardians.relationship, isPrimary: studentGuardians.isPrimary })
    .from(studentGuardians).innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId)).where(eq(studentGuardians.studentId, studentId));
  const f = await db.select().from(fees).where(eq(fees.studentId, studentId));
  const p = await db.select().from(payments).where(eq(payments.studentId, studentId));
  const st = s.student;
  return {
    academia: s.academy,
    aluno: {
      nome: st.name, cpf: st.cpf, dataNascimento: st.birthDate, telefone: st.phone, email: st.email,
      endereco: { cep: st.zip, rua: st.street, numero: st.number, complemento: st.complement, bairro: st.district, cidade: st.city, uf: st.state },
      modalidade: s.modality, dataEntrada: st.joinedAt, status: st.status, valorMensalCentavos: st.monthlyFeeCents, diaVencimento: st.dueDay,
      contatoEmergencia: st.emergencyName ? { nome: st.emergencyName, telefone: st.emergencyPhone, relacao: st.emergencyRelation } : null,
      usoDeImagem: st.imageConsent, usoDeImagemRegistradoEm: st.imageConsentAt,
      saude: st.healthNotes, saudeConsentimentoEm: st.healthConsentAt,
      observacoes: st.notes, fichaAssinadaEm: st.enrollmentSignedAt,
      consentimentoDados: st.dataConsentAt ? { em: st.dataConsentAt, texto: st.dataConsentText } : null,
    },
    responsaveis: g.map((x) => ({ nome: x.guardian.name, cpf: x.guardian.cpf, telefone: x.guardian.phone, email: x.guardian.email, parentesco: x.relationship, principal: x.isPrimary })),
    mensalidades: f.map((x) => ({ referencia: x.reference, vencimento: x.dueDate, valorCentavos: x.amountCents, status: x.status })),
    pagamentos: p.map((x) => ({ data: x.paidAt, valorCentavos: x.amountCents, forma: x.method, status: x.status, referencia: x.reference })),
  };
}

/** Exportação pelo administrador (a pedido do titular). Fica registrada na auditoria. */
export async function exportStudentData(ctx: AcademyContext, studentId: string) {
  const [s] = await db.select({ id: students.id, name: students.name }).from(students).where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId)));
  if (!s) throw new NotFoundError("Aluno");
  const data = await collect(s.id);
  await db.transaction((tx) => audit(tx, ctx, "student.data_exported", "student", s.id, `Dados de ${s.name} exportados a pedido do titular`));
  return { geradoEm: new Date().toISOString(), ...data };
}

/** O próprio aluno baixa os dados de todos os seus vínculos. */
export async function exportOwnData(ctx: StudentContext) {
  const [user] = await db.select({ name: users.name, email: users.email, phone: users.phone, birthDate: users.birthDate, dataConsentAt: users.dataConsentAt, dataConsentText: users.dataConsentText, createdAt: users.createdAt }).from(users).where(eq(users.id, ctx.userId));
  const links = await db.select({ id: students.id, academyId: students.academyId }).from(students).where(eq(students.userId, ctx.userId));
  const vinculos = [];
  for (const l of links) {
    vinculos.push(await collect(l.id));
    await db.transaction((tx) => audit(tx, { userId: ctx.userId, academyId: l.academyId }, "student.data_exported", "student", l.id, "Aluno baixou os próprios dados"));
  }
  return { geradoEm: new Date().toISOString(), conta: { nome: user.name, email: user.email, telefone: user.phone, nascimento: user.birthDate, consentimento: user.dataConsentAt ? { em: user.dataConsentAt, texto: user.dataConsentText } : null, criadaEm: user.createdAt }, vinculos };
}

export const ERASE_CONFIRMATION = "ELIMINAR";

/**
 * Eliminação a pedido do titular. Condições: aluno inativo e sem saldo em aberto
 * (enquanto há dívida, a academia tem motivo legítimo para manter os dados).
 */
export async function anonymizeStudent(ctx: AcademyContext, studentId: string, confirmation: string) {
  if (confirmation.trim().toUpperCase() !== ERASE_CONFIRMATION) throw new DomainError(`Digite ${ERASE_CONFIRMATION} para confirmar.`, { confirmation: "Confirmação incorreta." });
  const randomPassword = await hashPassword(randomBytes(24).toString("hex"));

  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(students).where(and(eq(students.id, studentId), eq(students.academyId, ctx.academyId))).for("update");
    if (!s) throw new NotFoundError("Aluno");
    if (s.anonymizedAt) throw new DomainError("Os dados deste aluno já foram eliminados.");
    if (s.status !== "inactive") throw new DomainError("Marque o aluno como inativo antes de eliminar os dados.");
    const [open] = await tx.select({ n: sql<number>`count(*)::int` }).from(fees)
      .where(and(eq(fees.studentId, s.id), eq(fees.status, "pending"),
        sql`${fees.amountCents} > coalesce((select sum(p.amount_cents) from payments p where p.fee_id = fees.id and p.status = 'paid'), 0)`));
    if (open.n > 0) throw new DomainError("O aluno tem mensalidades em aberto. Quite ou cancele as mensalidades antes de eliminar os dados.");
    const [waiting] = await tx.select({ n: sql<number>`count(*)::int` }).from(payments).where(and(eq(payments.studentId, s.id), eq(payments.status, "pending")));
    if (waiting.n > 0) throw new DomainError("Há pagamentos aguardando confirmação. Confirme ou cancele antes de eliminar os dados.");

    const alias = `Aluno removido ${s.id.slice(0, 6).toUpperCase()}`;
    const feeIds = (await tx.select({ id: fees.id }).from(fees).where(eq(fees.studentId, s.id))).map((x) => x.id);
    const paymentIds = (await tx.select({ id: payments.id }).from(payments).where(eq(payments.studentId, s.id))).map((x) => x.id);

    // 1. cadastro: tudo o que identifica a pessoa sai; matrícula e valores ficam
    await tx.update(students).set({
      name: alias, phone: null, email: null, cpf: null, birthDate: null, notes: null,
      zip: null, street: null, number: null, complement: null, district: null, city: null, state: null,
      emergencyName: null, emergencyPhone: null, emergencyRelation: null, imageConsent: null, imageConsentAt: null,
      healthNotes: null, healthConsentAt: null, dataConsentText: null, userId: null, anonymizedAt: new Date(),
    }).where(eq(students.id, s.id));

    // 2. financeiro: os valores ficam; textos livres e o nome nas descrições saem
    if (paymentIds.length) {
      await tx.update(payments).set({ notes: null }).where(inArray(payments.id, paymentIds));
      await tx.update(financialEntries).set({ description: sql`replace(${financialEntries.description}, ${s.name}, ${alias})`, notes: null })
        .where(inArray(financialEntries.paymentId, paymentIds));
    }
    if (feeIds.length) await tx.update(fees).set({ notes: null }).where(inArray(fees.id, feeIds));

    // 3. auditoria: o registro das ações continua; o nome é trocado pelo apelido anônimo
    const related = [s.id, ...feeIds, ...paymentIds];
    await tx.update(auditLogs).set({ summary: sql`replace(${auditLogs.summary}, ${s.name}, ${alias})` })
      .where(and(eq(auditLogs.academyId, ctx.academyId), inArray(auditLogs.entityId, related)));

    // 4. responsáveis: o vínculo sai; quem não é responsável por mais ninguém é apagado
    const links = await tx.select({ guardianId: studentGuardians.guardianId, name: guardians.name }).from(studentGuardians)
      .innerJoin(guardians, eq(guardians.id, studentGuardians.guardianId)).where(eq(studentGuardians.studentId, s.id));
    await tx.delete(studentGuardians).where(eq(studentGuardians.studentId, s.id));
    for (const { guardianId, name } of links) {
      const [others] = await tx.select({ n: sql<number>`count(*)::int` }).from(studentGuardians).where(eq(studentGuardians.guardianId, guardianId));
      if (others.n === 0) {
        await tx.delete(guardians).where(eq(guardians.id, guardianId));
        // o nome do responsável apagado também sai do histórico deste aluno
        await tx.update(auditLogs).set({ summary: sql`replace(${auditLogs.summary}, ${name}, 'Responsável removido')` })
          .where(and(eq(auditLogs.academyId, ctx.academyId), inArray(auditLogs.entityId, related)));
      }
    }

    // 5. conta de acesso: sem outros vínculos, é desativada e anonimizada; com outros, só se desliga desta academia
    if (s.userId) {
      const [others] = await tx.select({ n: sql<number>`count(*)::int` }).from(students).where(and(eq(students.userId, s.userId), ne(students.id, s.id)));
      if (others.n === 0) {
        await tx.update(users).set({ name: "Conta removida", email: `removido-${s.userId}@anonimo.invalid`, phone: null, birthDate: null, passwordHash: randomPassword, active: false }).where(eq(users.id, s.userId));
        await tx.delete(sessions).where(eq(sessions.userId, s.userId));
        await tx.delete(passwordResets).where(eq(passwordResets.userId, s.userId));
      }
    }

    await audit(tx, ctx, "student.anonymized", "student", s.id, `Dados pessoais de ${alias} eliminados a pedido do titular`);
    return { alias };
  });
}
