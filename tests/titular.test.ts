/** Recuperação de senha, recibo e direitos do titular (LGPD). */
import { and, eq, like } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, financialEntries, guardians, passwordResets, sessions, students, users } from "@/db/schema";
import { checkCredentials } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { today } from "@/lib/dates";
import { memoryMailer, useMailer } from "@/lib/email";
import { moneyInWords } from "@/lib/extenso";
import { createFee } from "@/services/fees";
import { guardiansOf } from "@/services/guardians";
import { checkResetToken, requestPasswordReset, resetPassword } from "@/services/password-reset";
import { createPayment } from "@/services/payments";
import { anonymizeStudent, exportStudentData } from "@/services/privacy";
import { getReceipt } from "@/services/receipts";
import { createStudent, setStudentStatus, updateHealth } from "@/services/students";
import { newAcademy, studentData } from "./helpers";

const outbox = memoryMailer();
beforeEach(() => { outbox.sent.length = 0; useMailer(outbox); });
afterEach(() => useMailer(null));
const tokenFrom = (text: string) => text.match(/\/redefinir-senha\/([A-Za-z0-9_-]+)/)![1];
const pay = (studentId: string, feeId: string | null, amount: number) => ({ studentId, feeId, amount, paidAt: today(), method: "pix" as const, status: "paid" as const, reference: null, notes: null });

describe("recuperação de senha", () => {
  it("envia um link de uso único, que troca a senha e encerra as sessões", async () => {
    const ctx = await newAcademy();
    const email = `reset${Date.now()}@teste.dev`;
    await db.update(users).set({ email, passwordHash: await hashPassword("senha-antiga-123") }).where(eq(users.id, ctx.userId));
    await db.insert(sessions).values({ userId: ctx.userId, tokenHash: `r${Date.now()}`.padEnd(64, "0"), expiresAt: new Date(Date.now() + 86_400_000) });

    await requestPasswordReset(email.toUpperCase(), "https://app.exemplo");
    expect(outbox.sent).toHaveLength(1);
    expect(outbox.sent[0].to).toBe(email);
    const token = tokenFrom(outbox.sent[0].text);
    expect(outbox.sent[0].text).toContain("https://app.exemplo/redefinir-senha/");
    const [stored] = await db.select().from(passwordResets).where(eq(passwordResets.userId, ctx.userId));
    expect(stored.tokenHash).not.toBe(token); // só o hash fica no banco

    expect(await checkResetToken(token)).toBe(true);
    await resetPassword(token, "senha-nova-4567");
    expect((await checkCredentials(email, "senha-nova-4567")).ok).toBe(true);
    expect((await checkCredentials(email, "senha-antiga-123")).ok).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, ctx.userId))).toHaveLength(0);
    await expect(resetPassword(token, "outra-senha-999")).rejects.toThrow("não é mais válido"); // uso único
  });

  it("e-mail inexistente: mesma resposta, nada enviado", async () => {
    await expect(requestPasswordReset(`ninguem${Date.now()}@teste.dev`, "https://app")).resolves.toBeUndefined();
    expect(outbox.sent).toHaveLength(0);
  });

  it("link expirado ou substituído por um pedido novo não funciona", async () => {
    const ctx = await newAcademy();
    const email = `exp${Date.now()}@teste.dev`;
    await db.update(users).set({ email }).where(eq(users.id, ctx.userId));
    await requestPasswordReset(email, "https://app");
    const first = tokenFrom(outbox.sent[0].text);
    await requestPasswordReset(email, "https://app");
    const second = tokenFrom(outbox.sent[1].text);
    expect(await checkResetToken(first)).toBe(false); // o pedido novo invalida o anterior
    await db.update(passwordResets).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(passwordResets.userId, ctx.userId));
    await expect(resetPassword(second, "senha-nova-4567")).rejects.toThrow("não é mais válido");
  });

  it("limita os pedidos por e-mail", async () => {
    const ctx = await newAcademy();
    const email = `limite${Date.now()}@teste.dev`;
    await db.update(users).set({ email }).where(eq(users.id, ctx.userId));
    for (let i = 0; i < 5; i++) await requestPasswordReset(email, "https://app");
    expect(outbox.sent).toHaveLength(3);
  });
});

describe("recibo", () => {
  it("valor por extenso", () => {
    expect(moneyInWords(15090)).toBe("cento e cinquenta reais e noventa centavos");
    expect(moneyInWords(10000)).toBe("cem reais");
    expect(moneyInWords(100)).toBe("um real");
    expect(moneyInWords(5)).toBe("cinco centavos");
    expect(moneyInWords(123456)).toBe("mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    expect(moneyInWords(110000)).toBe("mil e cem reais");
    expect(moneyInWords(200000000)).toBe("dois milhões de reais");
  });

  it("quem paga pela criança é o responsável principal; pendente não tem recibo; outra academia não vê", async () => {
    const ctx = await newAcademy();
    const kid = await createStudent(ctx, studentData(ctx, { name: "Pedro Souza", phone: null, email: null, birthDate: `${Number(today().slice(0, 4)) - 9}-01-10`, guardianName: "Juliana Souza", guardianPhone: "(33) 99877-6655", guardianRelationship: "Mãe" }));
    const fee = await createFee(ctx, { studentId: kid.id, amount: 11000, dueDate: "2099-01-10", reference: "2099-01", notes: null });
    const p = await createPayment(ctx, pay(kid.id, fee.id, 11000));
    const r = await getReceipt(ctx, p.id);
    expect([r.payer.name, r.payerIsGuardian, r.feeReference, r.number]).toEqual(["Juliana Souza", true, "2099-01", p.id.slice(0, 8).toUpperCase()]);
    const waiting = await createPayment(ctx, { ...pay(kid.id, null, 500), status: "pending" });
    await expect(getReceipt(ctx, waiting.id)).rejects.toThrow("não encontrado");
    await expect(getReceipt(await newAcademy(), p.id)).rejects.toThrow("não encontrado");
  });
});

describe("direitos do titular", () => {
  it("exporta os dados do aluno (inclusive saúde e responsáveis) e registra na auditoria", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx, { cpf: "529.982.247-25" }));
    await updateHealth(ctx, s.id, "Asma leve", true);
    const data = await exportStudentData(ctx, s.id);
    expect([data.aluno.nome, data.aluno.cpf, data.aluno.saude]).toEqual(["Victor Almeida", "529.982.247-25", "Asma leve"]);
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, s.id), eq(auditLogs.action, "student.data_exported")));
    expect(log).toBeTruthy();
    await expect(exportStudentData(await newAcademy(), s.id)).rejects.toThrow("não encontrado");
  });

  it("eliminação exige aluno inativo, sem saldo, e a palavra de confirmação", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    await expect(anonymizeStudent(ctx, s.id, "ELIMINAR")).rejects.toThrow("inativo");
    await setStudentStatus(ctx, s.id, "inactive");
    await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2020-01-10", reference: "2020-01", notes: null });
    await expect(anonymizeStudent(ctx, s.id, "ELIMINAR")).rejects.toThrow("mensalidades em aberto");
    await expect(anonymizeStudent(ctx, s.id, "sim")).rejects.toThrow("Digite ELIMINAR");
  });

  it("apaga os dados pessoais, mantém o financeiro anônimo e remove responsável sem outros alunos", async () => {
    const ctx = await newAcademy();
    const year = Number(today().slice(0, 4));
    const kid = await createStudent(ctx, studentData(ctx, { name: "Marina Teixeira", phone: null, email: null, cpf: "529.982.247-25", birthDate: `${year - 10}-02-02`, guardianName: "Carla Teixeira", guardianPhone: "(33) 99111-2233", guardianRelationship: "Mãe", emergencyName: "Avó", emergencyPhone: "(33) 99000-1111" }));
    const [carla] = await guardiansOf(ctx, kid.id);
    await updateHealth(ctx, kid.id, "Alergia a látex", true);
    const fee = await createFee(ctx, { studentId: kid.id, amount: 12000, dueDate: "2099-03-10", reference: "2099-03", notes: "Combinado com Carla" });
    await createPayment(ctx, pay(kid.id, fee.id, 12000));
    await setStudentStatus(ctx, kid.id, "inactive");

    const { alias } = await anonymizeStudent(ctx, kid.id, "eliminar");
    const [row] = await db.select().from(students).where(eq(students.id, kid.id));
    expect([row.name, row.cpf, row.birthDate, row.healthNotes, row.emergencyName, row.anonymizedAt !== null]).toEqual([alias, null, null, null, null, true]);
    expect(await db.select().from(guardians).where(eq(guardians.id, carla.id))).toHaveLength(0);

    const entries = await db.select().from(financialEntries).where(eq(financialEntries.academyId, ctx.academyId));
    expect(entries.map((e) => e.amountCents)).toEqual([12000]); // o financeiro continua
    expect(entries[0].description).not.toContain("Marina");
    expect(await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctx.academyId), like(auditLogs.summary, "%Marina%")))).toHaveLength(0);
    expect(await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctx.academyId), like(auditLogs.summary, "%Carla%")))).toHaveLength(0);
  });
});
