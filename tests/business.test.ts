import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, financialEntries } from "@/db/schema";
import { today } from "@/lib/dates";
import { DomainError } from "@/lib/errors";
import { cancelFee, createFee, generateMonthlyFees, getFee, listFees, updateFee } from "@/services/fees";
import { cancelEntry, createEntry, financeSummary } from "@/services/finance";
import { cancelPayment, confirmPayment, createPayment, listPayments } from "@/services/payments";
import { createStudent, getStudent, listStudents, studentFinancialSummary, updateStudent } from "@/services/students";
import { newAcademy, studentData } from "./helpers";

const pay = (studentId: string, feeId: string | null, amount: number, status: "paid" | "pending" = "paid") =>
  ({ studentId, feeId, amount, paidAt: today(), method: "pix" as const, status, reference: null, notes: null });

describe("alunos", () => {
  it("cria e pesquisa por nome, telefone e e-mail", async () => {
    const ctx = await newAcademy();
    await createStudent(ctx, studentData(ctx));
    await createStudent(ctx, studentData(ctx, { name: "Maria Souza", phone: "(33) 98888-1234", email: "maria@exemplo.dev" }));
    expect((await listStudents(ctx, { q: "vict" })).map((s) => s.name)).toEqual(["Victor Almeida"]);
    expect((await listStudents(ctx, { q: "98888" })).map((s) => s.name)).toEqual(["Maria Souza"]);
    expect((await listStudents(ctx, { q: "33988881234" })).map((s) => s.name)).toEqual(["Maria Souza"]); // só dígitos
    expect((await listStudents(ctx, { q: "MARIA@exemplo" })).map((s) => s.name)).toEqual(["Maria Souza"]);
  });

  it("filtra por status e registra alteração na auditoria", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    await updateStudent(ctx, s.id, { ...studentData(ctx), status: "inactive", monthlyFee: 17000 });
    expect(await listStudents(ctx, { status: "active" })).toHaveLength(0);
    expect((await listStudents(ctx, { status: "inactive" }))[0].monthlyFeeCents).toBe(17000);
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctx.academyId), eq(auditLogs.action, "student.updated")));
    expect(logs[0].data).toEqual({ fields: expect.arrayContaining(["status", "monthlyFeeCents"]) });
  });
});

describe("isolamento entre academias", () => {
  it("a Academia A não enxerga nem altera nada da Academia B, mesmo sabendo o ID", async () => {
    const a = await newAcademy("A");
    const b = await newAcademy("B");
    const maria = await createStudent(b, studentData(b, { name: "Maria" }));
    const fee = await createFee(b, { studentId: maria.id, amount: 15000, dueDate: "2026-09-10", reference: "2026-09", notes: null });

    await expect(getStudent(a, maria.id)).rejects.toThrow("Aluno não encontrado");
    await expect(updateStudent(a, maria.id, studentData(a))).rejects.toThrow("não encontrado");
    await expect(getFee(a, fee.id)).rejects.toThrow("não encontrad");
    await expect(createFee(a, { studentId: maria.id, amount: 100, dueDate: "2026-09-10", reference: "2026-10", notes: null })).rejects.toThrow("Aluno não encontrado");
    await expect(createPayment(a, pay(maria.id, fee.id, 15000))).rejects.toThrow("Aluno não encontrado");
    expect(await listStudents(a)).toHaveLength(0);
    expect(await listFees(a)).toHaveLength(0);
  });
});

describe("mensalidades", () => {
  it("atrasada é calculada pelo vencimento, sem mudar o status gravado", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const late = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2020-01-10", reference: "2020-01", notes: null });
    await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2099-01-10", reference: "2099-01", notes: null });
    expect(late.status).toBe("pending");
    expect((await getFee(ctx, late.id)).displayStatus).toBe("overdue");
    expect((await listFees(ctx, { status: "overdue" })).map((f) => f.reference)).toEqual(["2020-01"]);
    expect((await listFees(ctx, { status: "pending" })).map((f) => f.reference)).toEqual(["2099-01"]);
    expect((await studentFinancialSummary(ctx, s.id)).situation).toBe("overdue");
  });

  it("não duplica período do mesmo aluno", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2026-09-10", reference: "2026-09", notes: null });
    await expect(createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2026-09-15", reference: "2026-09", notes: null })).rejects.toThrow("já tem uma mensalidade");
  });

  it("gera o mês para todos os ativos com o valor e o dia de cada um, sem duplicar", async () => {
    const ctx = await newAcademy();
    await createStudent(ctx, studentData(ctx, { name: "Ativo Um", monthlyFee: 15000, dueDay: 5 }));
    await createStudent(ctx, studentData(ctx, { name: "Ativo Dois", monthlyFee: 20000, dueDay: 31 }));
    await createStudent(ctx, studentData(ctx, { name: "Inativo", status: "inactive" }));
    expect(await generateMonthlyFees(ctx, "2026-02")).toEqual({ created: 2, skipped: 0 });
    expect(await generateMonthlyFees(ctx, "2026-02")).toEqual({ created: 0, skipped: 2 });
    const list = await listFees(ctx, { from: "2026-02-01", to: "2026-02-28" });
    expect(list.map((f) => [f.studentName, f.amountCents, f.dueDate])).toEqual([["Ativo Um", 15000, "2026-02-05"], ["Ativo Dois", 20000, "2026-02-28"]]);
  });
});

describe("pagamentos", () => {
  it("parcial mantém pendente com saldo; o restante quita e gera as entradas no financeiro", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2099-09-10", reference: "2099-09", notes: null });

    await createPayment(ctx, pay(s.id, fee.id, 10000));
    let f = await getFee(ctx, fee.id);
    expect([f.status, f.paidCents, f.balanceCents]).toEqual(["pending", 10000, 5000]);

    await expect(createPayment(ctx, pay(s.id, fee.id, 6000))).rejects.toThrow("passa do saldo"); // não paga mais que o devido
    await createPayment(ctx, pay(s.id, fee.id, 5000));
    f = await getFee(ctx, fee.id);
    expect([f.status, f.balanceCents]).toEqual(["paid", 0]);

    const entries = await db.select().from(financialEntries).where(eq(financialEntries.academyId, ctx.academyId));
    expect(entries.map((e) => [e.type, e.category, e.amountCents])).toEqual([["income", "Mensalidade", 10000], ["income", "Mensalidade", 5000]]);
    await expect(createPayment(ctx, pay(s.id, fee.id, 100))).rejects.toThrow("já está paga");
  });

  it("cancelar devolve a mensalidade para atrasada (se venceu) e tira a entrada do saldo", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2020-03-10", reference: "2020-03", notes: null });
    const p = await createPayment(ctx, pay(s.id, fee.id, 15000));
    expect((await getFee(ctx, fee.id)).displayStatus).toBe("paid");

    await expect(cancelPayment(ctx, p.id, "")).rejects.toThrow("motivo");
    await cancelPayment(ctx, p.id, "Pix estornado");
    expect((await getFee(ctx, fee.id)).displayStatus).toBe("overdue");
    const [entry] = await db.select().from(financialEntries).where(eq(financialEntries.paymentId, p.id));
    expect(entry.status).toBe("canceled");
    expect((await financeSummary(ctx, "2000-01-01", "2100-01-01")).incomeCents).toBe(0);
    const [cancelLog] = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, p.id), eq(auditLogs.action, "payment.canceled")));
    expect(cancelLog.userId).toBe(ctx.userId);
  });

  it("mensalidade paga não pode ser editada nem cancelada; com pagamento parcial também não", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2099-09-10", reference: "2099-09", notes: null });
    await createPayment(ctx, pay(s.id, fee.id, 1000));
    await expect(updateFee(ctx, fee.id, { amount: 500, dueDate: "2099-09-10", reference: "2099-09", notes: null })).rejects.toThrow("já recebeu pagamento");
    await expect(cancelFee(ctx, fee.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("pagamento pendente não conta até ser confirmado", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2099-09-10", reference: "2099-09", notes: null });
    const p = await createPayment(ctx, pay(s.id, fee.id, 15000, "pending"));
    expect((await getFee(ctx, fee.id)).status).toBe("pending");
    expect((await financeSummary(ctx, "2000-01-01", "2100-01-01")).incomeCents).toBe(0);
    await confirmPayment(ctx, p.id);
    expect((await getFee(ctx, fee.id)).status).toBe("paid");
    expect((await financeSummary(ctx, "2000-01-01", "2100-01-01")).incomeCents).toBe(15000);
  });

  it("filtra pagamentos por forma e por aluno", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    await createPayment(ctx, { ...pay(s.id, null, 8000), method: "cash", reference: "Matrícula" });
    await createPayment(ctx, pay(s.id, null, 3000));
    expect((await listPayments(ctx, { method: "cash" })).map((p) => p.amountCents)).toEqual([8000]);
    expect(await listPayments(ctx, { q: "victor" })).toHaveLength(2);
  });
});

describe("financeiro", () => {
  it("entradas, saídas e saldo do período em centavos exatos", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    await createPayment(ctx, { ...pay(s.id, null, 15090), paidAt: "2026-09-05" });
    await createEntry(ctx, { type: "income", category: "Matrícula", description: "Matrícula", amount: 8010, date: "2026-09-06", notes: null });
    await createEntry(ctx, { type: "expense", category: "Equipamentos", description: "Luvas", amount: 64000, date: "2026-09-07", notes: null });
    const fora = await createEntry(ctx, { type: "expense", category: "Manutenção", description: "Fora do período", amount: 99999, date: "2026-10-01", notes: null });

    expect(await financeSummary(ctx, "2026-09-01", "2026-09-30")).toEqual({ incomeCents: 23100, expenseCents: 64000, balanceCents: -40900 });
    await cancelEntry(ctx, fora.id);
    expect((await financeSummary(ctx, "2026-10-01", "2026-10-31")).expenseCents).toBe(0);
  });

  it("entrada gerada por pagamento só pode ser desfeita cancelando o pagamento", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const p = await createPayment(ctx, pay(s.id, null, 5000));
    const [entry] = await db.select().from(financialEntries).where(eq(financialEntries.paymentId, p.id));
    await expect(cancelEntry(ctx, entry.id)).rejects.toThrow("cancele o pagamento");
  });
});

describe("totais agregados (subconsultas)", () => {
  it("perfil, lista de alunos, dashboard e plataforma contam o que foi pago", async () => {
    const { dashboard } = await import("@/services/dashboard");
    const { listAcademiesOverview } = await import("@/services/users");
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    const fee = await createFee(ctx, { studentId: s.id, amount: 15000, dueDate: "2020-05-10", reference: "2020-05", notes: null });
    await createPayment(ctx, pay(s.id, fee.id, 10000));

    const summary = await studentFinancialSummary(ctx, s.id);
    expect([summary.situation, summary.openCents, summary.overdueCount]).toEqual(["overdue", 5000, 1]);
    expect((await listStudents(ctx))[0].overdue).toBe(1);
    const d = await dashboard(ctx, "2020-05");
    expect([d.fees.overdueCount, d.fees.overdueCents]).toEqual([1, 5000]);
    const mine = (await listAcademiesOverview({ userId: ctx.userId, role: "PLATFORM_ADMIN" })).find((a) => a.id === ctx.academyId);
    expect([mine?.students, mine?.admins]).toEqual([1, 1]);
  });

  it("meses de 30 dias e fevereiro no intervalo do mês", async () => {
    const { monthRange } = await import("@/lib/dates");
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2026-02").to).toBe("2026-02-28");
  });
});
