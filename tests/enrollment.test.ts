import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { invites, students, users } from "@/db/schema";
import { today } from "@/lib/dates";
import { signupInput } from "@/lib/validation";
import { approveByLinking, approveRequest, joinWithInvite, listRequests, membershipsOf, rejectRequest, signUpWithInvite } from "@/services/enrollment";
import { generateMonthlyFees, listFees } from "@/services/fees";
import { currentInvite, regenerateInvite, resolveInvite } from "@/services/invites";
import { createPayment } from "@/services/payments";
import { studentOverview } from "@/services/student-portal";
import { createStudent, getStudent, listStudents } from "@/services/students";
import { modalityOf, newAcademy, studentData } from "./helpers";

let seq = 0;
const signup = (overrides: Record<string, string> = {}) => {
  seq++;
  const parsed = signupInput.parse({
    name: "João da Silva", phone: "(33) 99811-2233", email: `joao${seq}@aluno.dev`, birthDate: "1998-05-20",
    password: "senha-do-joao-123", confirm: "senha-do-joao-123", consent: "on", ...overrides,
  });
  return parsed;
};
const approval = { modalityId: "", joinedAt: today(), monthlyFee: 15000, dueDay: 10, notes: null };

describe("convite", () => {
  it("o token não identifica a academia e só o servidor resolve", async () => {
    const ctx = await newAcademy("Convite");
    const invite = await currentInvite(ctx);
    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(invite.token).not.toContain(ctx.academyId.slice(0, 8));
    expect((await resolveInvite(invite.token))?.academyId).toBe(ctx.academyId);
    expect(await currentInvite(ctx)).toMatchObject({ id: invite.id }); // mesmo convite enquanto for válido
    expect(await resolveInvite("token-que-nao-existe-123")).toBeNull();
    expect(await resolveInvite("../../etc")).toBeNull();
  });

  it("gerar um novo código revoga o anterior", async () => {
    const ctx = await newAcademy();
    const old = await currentInvite(ctx);
    const fresh = await regenerateInvite(ctx);
    expect(await resolveInvite(old.token)).toBeNull();
    expect(await resolveInvite(fresh.token)).not.toBeNull();
    await expect(signUpWithInvite(old.token, signup())).rejects.toThrow("não é mais válido");
  });

  it("respeita validade e limite de usos (estrutura pronta para o futuro)", async () => {
    const ctx = await newAcademy();
    const invite = await currentInvite(ctx);
    await db.update(invites).set({ maxUses: 1 }).where(eq(invites.id, invite.id));
    await signUpWithInvite(invite.token, signup());
    await expect(signUpWithInvite(invite.token, signup())).rejects.toThrow("não é mais válido");
    await db.update(invites).set({ maxUses: null, expiresAt: new Date(Date.now() - 1000) }).where(eq(invites.id, invite.id));
    expect(await resolveInvite(invite.token)).toBeNull();
  });
});

describe("cadastro pelo convite", () => {
  it("cria a conta STUDENT sem academia e o pedido pendente só na academia do convite", async () => {
    const a = await newAcademy("A");
    const b = await newAcademy("B");
    const { userId, studentId } = await signUpWithInvite((await currentInvite(a)).token, signup());

    const [account] = await db.select().from(users).where(eq(users.id, userId));
    expect([account.role, account.academyId]).toEqual(["STUDENT", null]);
    expect(account.passwordHash).not.toContain("senha-do-joao");
    const [request] = await db.select().from(students).where(eq(students.id, studentId));
    expect([request.academyId, request.status, request.modalityId, request.monthlyFeeCents]).toEqual([a.academyId, "pending", null, null]);

    expect((await listRequests(a)).map((r) => r.id)).toEqual([studentId]);
    expect(await listRequests(b)).toEqual([]);                                   // B não vê
    await expect(approveRequest(b, studentId, { ...approval, modalityId: modalityOf(b) })).rejects.toThrow("não encontrado"); // B não aprova
    await expect(rejectRequest(b, studentId, null)).rejects.toThrow("não encontrado");
  });

  it("pendente não aparece na lista de alunos, não recebe mensalidade nem pagamento", async () => {
    const ctx = await newAcademy();
    const { studentId } = await signUpWithInvite((await currentInvite(ctx)).token, signup());
    expect(await listStudents(ctx)).toEqual([]);
    await expect(getStudent(ctx, studentId)).rejects.toThrow("não encontrado");
    expect((await generateMonthlyFees(ctx, "2026-09")).created).toBe(0);
    await expect(createPayment(ctx, { studentId, feeId: null, amount: 100, paidAt: today(), method: "pix", status: "paid", reference: null, notes: null })).rejects.toThrow("Aluno não encontrado");
  });

  it("recusa menores de 18 anos, e-mail repetido e senhas diferentes", async () => {
    // quem faz 18 anos amanhã (conta com Date em UTC: funciona também nos dias 28 a 31 e na virada do mês)
    const [ty, tm, td] = today().split("-").map(Number);
    const eighteenYearsAgoTomorrow = new Date(Date.UTC(ty - 18, tm - 1, td + 1)).toISOString().slice(0, 10);
    const minor = signupInput.safeParse({ name: "Ana Souza", phone: "(33) 99811-2233", email: "ana@x.dev", birthDate: eighteenYearsAgoTomorrow, password: "1234567890", confirm: "1234567890", consent: "on" });
    expect(minor.success).toBe(false);
    expect(minor.error?.issues[0].message).toContain("maiores de 18");
    expect(signupInput.safeParse({ name: "Ana Souza", phone: "(33) 99811-2233", email: "ana@x.dev", birthDate: "1990-01-01", password: "1234567890", confirm: "outra-senha", consent: "on" }).success).toBe(false);
    expect(signupInput.safeParse({ name: "Ana Souza", phone: "(33) 99811-2233", email: "ana@x.dev", birthDate: "1990-01-01", password: "1234567890", confirm: "1234567890" }).success).toBe(false); // sem consentimento

    const ctx = await newAcademy();
    const token = (await currentInvite(ctx)).token;
    const data = signup();
    await signUpWithInvite(token, data);
    await expect(signUpWithInvite(token, { ...data, email: data.email.toUpperCase().toLowerCase() })).rejects.toThrow("Já existe uma conta");
  });
});

describe("aprovação", () => {
  it("aprovar completa os dados da academia e libera a área do aluno", async () => {
    const ctx = await newAcademy();
    const { userId, studentId } = await signUpWithInvite((await currentInvite(ctx)).token, signup());
    await expect(studentOverview({ userId, role: "STUDENT" }, studentId)).rejects.toThrow("não encontrado"); // pendente: sem acesso

    await approveRequest(ctx, studentId, { ...approval, modalityId: modalityOf(ctx) });
    expect((await getStudent(ctx, studentId)).status).toBe("active");
    await expect(approveRequest(ctx, studentId, { ...approval, modalityId: modalityOf(ctx) })).rejects.toThrow("já foi analisado");

    expect((await generateMonthlyFees(ctx, "2026-09")).created).toBe(1);
    const view = await studentOverview({ userId, role: "STUDENT" }, studentId);
    expect([view.me.modality, view.fees.length, view.fees[0].amountCents]).toEqual(["Boxe", 1, 15000]);
  });

  it("o aluno só vê os próprios dados", async () => {
    const ctx = await newAcademy();
    const token = (await currentInvite(ctx)).token;
    const ana = await signUpWithInvite(token, signup({ name: "Ana Lima" }));
    const bia = await signUpWithInvite(token, signup({ name: "Bia Rocha" }));
    await approveRequest(ctx, ana.studentId, { ...approval, modalityId: modalityOf(ctx) });
    await approveRequest(ctx, bia.studentId, { ...approval, modalityId: modalityOf(ctx) });
    await expect(studentOverview({ userId: ana.userId, role: "STUDENT" }, bia.studentId)).rejects.toThrow("não encontrado");
  });

  it("sugere e vincula ao aluno já cadastrado, mantendo o histórico financeiro", async () => {
    const ctx = await newAcademy();
    const existing = await createStudent(ctx, studentData(ctx, { name: "João Pereira", email: "joao.p@aluno.dev", phone: "(33) 99700-1122" }));
    await generateMonthlyFees(ctx, "2026-08");

    const { userId, studentId } = await signUpWithInvite((await currentInvite(ctx)).token, signup({ email: "outro@aluno.dev", phone: "33 99700-1122" }));
    const [request] = await listRequests(ctx);
    expect(request.matches.map((m) => m.id)).toEqual([existing.id]); // mesmo telefone

    await approveByLinking(ctx, studentId, existing.id);
    const linked = await getStudent(ctx, existing.id);
    expect([linked.userId, linked.status]).toEqual([userId, "active"]);
    expect(await listRequests(ctx)).toEqual([]);
    expect((await studentOverview({ userId, role: "STUDENT" }, existing.id)).fees).toHaveLength(1); // histórico preservado
    expect(await listFees(ctx, { studentId: existing.id })).toHaveLength(1);
  });

  it("não vincula a aluno de outra academia", async () => {
    const a = await newAcademy();
    const b = await newAcademy();
    const other = await createStudent(b, studentData(b));
    const { studentId } = await signUpWithInvite((await currentInvite(a)).token, signup());
    await expect(approveByLinking(a, studentId, other.id)).rejects.toThrow("Escolha um aluno já cadastrado nesta academia");
  });

  it("recusar guarda o histórico e o aluno vê o aviso", async () => {
    const ctx = await newAcademy("Recusa");
    const { userId, studentId } = await signUpWithInvite((await currentInvite(ctx)).token, signup());
    await rejectRequest(ctx, studentId, "Não reconhecemos o cadastro");
    const [m] = await membershipsOf(userId);
    expect([m.status, m.rejectionReason]).toEqual(["rejected", "Não reconhecemos o cadastro"]);
    await expect(joinWithInvite(userId, (await currentInvite(ctx)).token, true)).rejects.toThrow("foi recusado");
  });

  it("uma conta pode pedir para entrar em outra academia", async () => {
    const a = await newAcademy();
    const b = await newAcademy();
    const { userId } = await signUpWithInvite((await currentInvite(a)).token, signup());
    await joinWithInvite(userId, (await currentInvite(b)).token, true);
    expect((await membershipsOf(userId)).map((m) => m.status)).toEqual(["pending", "pending"]);
    await expect(joinWithInvite(userId, (await currentInvite(b)).token, true)).rejects.toThrow("já tem vínculo");
  });
});

describe("estrutura para um novo pedido após recusa", () => {
  it("o pedido recusado fica no histórico e não impede outro vínculo da mesma conta", async () => {
    const ctx = await newAcademy();
    const { userId, studentId } = await signUpWithInvite((await currentInvite(ctx)).token, signup());
    await rejectRequest(ctx, studentId, "Dados incompletos");
    // no MVP a tela não oferece um novo pedido, mas o banco já aceita, sem apagar o recusado
    await db.insert(students).values({ academyId: ctx.academyId, userId, status: "pending", name: "João da Silva" });
    const rows = await db.select({ status: students.status }).from(students).where(eq(students.userId, userId));
    expect(rows.map((r) => r.status).sort()).toEqual(["pending", "rejected"]);
    // e continua impossível ter dois vínculos em aberto na mesma academia
    await expect(db.insert(students).values({ academyId: ctx.academyId, userId, status: "pending", name: "João da Silva" })).rejects.toThrow();
    const [rejected] = await db.select().from(students).where(eq(students.id, studentId));
    expect(rejected.closedAt).not.toBeNull();
  });
});
