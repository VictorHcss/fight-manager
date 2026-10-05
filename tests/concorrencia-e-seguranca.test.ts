/**
 * Correções da revisão de requisitos: totais sobre o filtro inteiro, paginação,
 * consentimento registrado, sessões encerradas e concorrência (locks provados).
 */
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { invites, sessions, students, users } from "@/db/schema";
import { today } from "@/lib/dates";
import { signupInput } from "@/lib/validation";
import { approveRequest, joinWithInvite, signUpWithInvite } from "@/services/enrollment";
import { createFee, feesSummary, generateMonthlyFees, getFee, listFees } from "@/services/fees";
import { currentInvite } from "@/services/invites";
import { createPayment, listPayments, paymentsSummary } from "@/services/payments";
import { createStudent } from "@/services/students";
import { changePassword, createAcademyAdmin, setUserActive } from "@/services/users";
import { hashPassword } from "@/lib/auth/password";
import { modalityOf, newAcademy, studentData } from "./helpers";

const pay = (studentId: string, feeId: string | null, amount: number) =>
  ({ studentId, feeId, amount, paidAt: today(), method: "pix" as const, status: "paid" as const, reference: null, notes: null });
let seq = 0;
const signup = () => signupInput.parse({ name: "Ana Paula Lima", phone: "(33) 99811-2233", email: `ana${++seq}-${Date.now()}@aluno.dev`, birthDate: "1995-05-20", password: "senha-da-ana-12", confirm: "senha-da-ana-12", consent: "on" });

describe("totais e paginação", () => {
  it("o total é do filtro inteiro, não só da página", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    for (let i = 0; i < 205; i++) await createPayment(ctx, pay(s.id, null, 100));
    expect(await paymentsSummary(ctx, {})).toEqual({ count: 205, paidCents: 20500 });
    expect(await listPayments(ctx, {}, 50, 200)).toHaveLength(5); // última página

    // páginas não repetem nem pulam registros
    const seen = new Set<string>();
    for (let page = 0; page < 5; page++) (await listPayments(ctx, {}, 50, page * 50)).forEach((p) => seen.add(p.id));
    expect(seen.size).toBe(205);
  });

  it("saldo em aberto das mensalidades considera pagamentos parciais de todas as páginas", async () => {
    const ctx = await newAcademy();
    for (let i = 0; i < 60; i++) await createStudent(ctx, studentData(ctx, { name: `Aluno ${String(i).padStart(2, "0")}`, email: null, phone: null }));
    await generateMonthlyFees(ctx, "2099-01");
    const [first] = await listFees(ctx, {}, 1);
    await createPayment(ctx, pay(first.studentId, first.id, 5000));
    expect(await feesSummary(ctx, {})).toEqual({ count: 60, openCents: 60 * 15000 - 5000 });
    expect(await listFees(ctx, {}, 50, 50)).toHaveLength(10);
  });
});

describe("consentimento do convite", () => {
  it("guarda quando e qual texto foi aceito; sem consentimento não entra em outra academia", async () => {
    const a = await newAcademy("Consentimento");
    const { studentId, userId } = await signUpWithInvite((await currentInvite(a)).token, signup());
    const [row] = await db.select().from(students).where(eq(students.id, studentId));
    expect(row.dataConsentAt).not.toBeNull();
    expect(row.dataConsentText).toContain("Consentimento"); // nome da academia no texto aceito

    const b = await newAcademy();
    await expect(joinWithInvite(userId, (await currentInvite(b)).token, false)).rejects.toThrow("concordar");
    const joined = await joinWithInvite(userId, (await currentInvite(b)).token, true);
    const [row2] = await db.select().from(students).where(eq(students.id, joined.id));
    expect(row2.dataConsentAt).not.toBeNull();
  });
});

describe("sessões", () => {
  it("trocar a senha encerra as sessões da conta; desativar também", async () => {
    const ctx = await newAcademy();
    await db.update(users).set({ passwordHash: await hashPassword("senha-antiga-123") }).where(eq(users.id, ctx.userId));
    const future = new Date(Date.now() + 86_400_000);
    await db.insert(sessions).values([{ userId: ctx.userId, tokenHash: `a${Date.now()}`.padEnd(64, "0"), expiresAt: future }, { userId: ctx.userId, tokenHash: `b${Date.now()}`.padEnd(64, "0"), expiresAt: future }]);
    await changePassword(ctx.userId, ctx.academyId, "senha-antiga-123", "senha-nova-4567");
    expect(await db.select().from(sessions).where(eq(sessions.userId, ctx.userId))).toHaveLength(0);

    const other = await createAcademyAdmin(ctx, { name: "Outro Admin", email: `outro${Date.now()}@teste.dev`, password: "senha-do-outro-1" });
    await db.insert(sessions).values({ userId: other.id, tokenHash: `c${Date.now()}`.padEnd(64, "0"), expiresAt: future });
    await setUserActive(ctx, other.id, false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, other.id))).toHaveLength(0);
  });
});

describe("concorrência (os locks seguram operações simultâneas)", () => {
  it("dois pagamentos ao mesmo tempo não passam do saldo da mensalidade", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2099-01-10", reference: "2099-01", notes: null });
    const results = await Promise.allSettled([createPayment(ctx, pay(s.id, fee.id, 10000)), createPayment(ctx, pay(s.id, fee.id, 10000))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toContain("passa do saldo");
    expect((await getFee(ctx, fee.id)).paidCents).toBe(10000);
  });

  it("dez pagamentos simultâneos quitam exatamente o valor, sem sobrar nem faltar", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 5000, dueDate: "2099-02-10", reference: "2099-02", notes: null });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => createPayment(ctx, pay(s.id, fee.id, 1000))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    const f = await getFee(ctx, fee.id);
    expect([f.paidCents, f.status]).toEqual([5000, "paid"]);
  });

  it("convite com limite de 1 uso, dois cadastros ao mesmo tempo: só um entra", async () => {
    const ctx = await newAcademy();
    const invite = await currentInvite(ctx);
    await db.update(invites).set({ maxUses: 1 }).where(eq(invites.id, invite.id));
    const results = await Promise.allSettled([signUpWithInvite(invite.token, signup()), signUpWithInvite(invite.token, signup())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [row] = await db.select().from(invites).where(eq(invites.id, invite.id));
    expect(row.usesCount).toBe(1);
  });

  it("mesmo e-mail em dois cadastros simultâneos: um entra, o outro recebe a mensagem certa", async () => {
    const ctx = await newAcademy();
    const token = (await currentInvite(ctx)).token;
    const data = signup();
    const results = await Promise.allSettled([signUpWithInvite(token, data), signUpWithInvite(token, data)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toContain("Já existe uma conta com este e-mail");
  });

  it("dois administradores aprovando o mesmo pedido ao mesmo tempo: só uma aprovação vale", async () => {
    const ctx = await newAcademy();
    const { studentId } = await signUpWithInvite((await currentInvite(ctx)).token, signup());
    const approval = { modalityId: modalityOf(ctx), joinedAt: today(), monthlyFee: 15000, dueDay: 10, notes: null };
    const results = await Promise.allSettled([approveRequest(ctx, studentId, approval), approveRequest(ctx, studentId, approval)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toContain("já foi analisado");
  });
});
