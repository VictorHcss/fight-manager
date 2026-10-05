// Contas fora do convite: aluno sem academia, academia criada pela plataforma e convite por e-mail.
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { academies, auditLogs, users } from "@/db/schema";
import { checkCredentials } from "@/lib/auth/login";
import { memoryMailer, useMailer } from "@/lib/email";
import { inviteTokenFrom, studentAccountInput } from "@/lib/validation";
import { createAcademyWithAdmin, resendAdminAccess, signUpStudent } from "@/services/accounts";
import { addStudentByEmail, approveRequest, listRequests, membershipsOf } from "@/services/enrollment";
import { currentInvite, sendInviteEmail } from "@/services/invites";
import { checkResetToken, resetPassword } from "@/services/password-reset";
import { modalityOf, newAcademy } from "./helpers";

let n = 0;
const account = (overrides: Record<string, string> = {}) => {
  n++;
  return studentAccountInput.parse({
    name: "Gabriel Moreira", phone: "(33) 99655-3020", email: `gabriel${n}-${Date.now()}@conta.dev`, birthDate: "1998-11-03",
    password: "senha-do-gabriel", confirm: "senha-do-gabriel", consent: "on", ...overrides,
  });
};
const platform = async () => {
  const [u] = await db.insert(users).values({ academyId: null, role: "PLATFORM_ADMIN", name: "Plataforma", email: `plat${Date.now()}${Math.random()}@p.dev`, passwordHash: "x" }).returning();
  return { userId: u.id, role: "PLATFORM_ADMIN" as const };
};
const tokenFrom = (link: string) => link.split("/redefinir-senha/")[1];

let mail: ReturnType<typeof memoryMailer>;
beforeEach(() => { mail = memoryMailer(); useMailer(mail); });
afterEach(() => useMailer(null));

describe("conta de aluno sem academia", () => {
  it("cria a conta STUDENT sem academia, com telefone, nascimento e consentimento", async () => {
    const data = account();
    const { userId } = await signUpStudent(data);
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user).toMatchObject({ role: "STUDENT", academyId: null, phone: data.phone, birthDate: data.birthDate });
    expect(user.dataConsentAt).not.toBeNull();
    expect(await membershipsOf(userId)).toEqual([]);
    expect((await checkCredentials(data.email, "senha-do-gabriel")).ok).toBe(true);
  });

  it("recusa e-mail já usado (sem diferenciar maiúsculas) e menores de 18", async () => {
    const data = account();
    await signUpStudent(data);
    await expect(signUpStudent(studentAccountInput.parse({ ...data, email: data.email.toUpperCase() }))).rejects.toThrow("Já existe uma conta");
    expect(studentAccountInput.safeParse({ ...data, birthDate: `${new Date().getFullYear() - 10}-01-01` }).success).toBe(false);
  });
});

describe("academia adiciona aluno pelo e-mail da conta", () => {
  it("cria um pedido pendente com os dados da conta; aprovado, o aluno passa a ver a academia", async () => {
    const ctx = await newAcademy();
    const data = account();
    const { userId } = await signUpStudent(data);
    const { studentId } = await addStudentByEmail(ctx, `  ${data.email.toUpperCase()} `);
    const [request] = await listRequests(ctx);
    expect(request).toMatchObject({ id: studentId, userId, status: "pending", phone: data.phone, birthDate: data.birthDate, inviteId: null });
    expect(request.dataConsentAt).not.toBeNull();

    await approveRequest(ctx, studentId, { modalityId: modalityOf(ctx), joinedAt: "2026-09-01", monthlyFee: 15000, dueDay: 10, notes: null });
    expect((await membershipsOf(userId)).map((m) => m.status)).toEqual(["active"]);
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, studentId), eq(auditLogs.action, "enrollment.added")));
    expect(log).toBeDefined();
  });

  it("não adiciona duas vezes, nem contas que não são de aluno, nem e-mail inexistente", async () => {
    const ctx = await newAcademy();
    const data = account();
    await signUpStudent(data);
    await addStudentByEmail(ctx, data.email);
    await expect(addStudentByEmail(ctx, data.email)).rejects.toThrow("pedido pendente");
    const [admin] = await db.select().from(users).where(eq(users.id, ctx.userId));
    await expect(addStudentByEmail(ctx, admin.email)).rejects.toThrow("Nenhuma conta de aluno");
    await expect(addStudentByEmail(ctx, "ninguem@conta.dev")).rejects.toThrow("Nenhuma conta de aluno");
  });

  it("cada academia só vê os próprios pedidos; outra academia pode adicionar a mesma conta", async () => {
    const [a, b] = [await newAcademy(), await newAcademy()];
    const data = account();
    await signUpStudent(data);
    await addStudentByEmail(a, data.email);
    expect(await listRequests(b)).toEqual([]);
    await addStudentByEmail(b, data.email);
    expect(await listRequests(b)).toHaveLength(1);
  });

  it("sugere vincular ao cadastro existente com o mesmo e-mail", async () => {
    const ctx = await newAcademy();
    const data = account();
    const { createStudent } = await import("@/services/students");
    const { studentData } = await import("./helpers");
    const existing = await createStudent(ctx, studentData(ctx, { email: data.email }));
    await signUpStudent(data);
    await addStudentByEmail(ctx, data.email);
    const [request] = await listRequests(ctx);
    expect(request.matches.map((m) => m.id)).toEqual([existing.id]);
  });
});

describe("academia criada pela plataforma", () => {
  it("cria academia e responsável, envia o link de acesso e o responsável define a senha", async () => {
    const ctx = await platform();
    const email = `dono${Date.now()}@academia.dev`;
    const r = await createAcademyWithAdmin(ctx, { academyName: "Academia Nova", adminName: "Carla Dias", adminEmail: email }, "https://fm.dev");
    expect(r.sent).toBe(true);
    expect(mail.sent.at(-1)).toMatchObject({ to: email });
    expect(mail.sent.at(-1)!.text).toContain(r.link);

    const [academy] = await db.select().from(academies).where(eq(academies.id, r.academyId));
    expect(academy).toMatchObject({ name: "Academia Nova", email, active: true });
    const [admin] = await db.select().from(users).where(eq(users.id, r.userId));
    expect(admin).toMatchObject({ role: "ACADEMY_ADMIN", academyId: r.academyId });

    // ninguém conhece a senha inicial: só o link permite entrar
    await resetPassword(tokenFrom(r.link), "senha-da-carla-1");
    expect(await checkCredentials(email, "senha-da-carla-1")).toMatchObject({ ok: true, role: "ACADEMY_ADMIN" });
    expect(await checkResetToken(tokenFrom(r.link))).toBe(false); // uso único
  });

  it("recusa e-mail já usado e um novo link invalida o anterior", async () => {
    const ctx = await platform();
    const email = `dono2-${Date.now()}@academia.dev`;
    const r = await createAcademyWithAdmin(ctx, { academyName: "Academia Dois", adminName: "Rui Lima", adminEmail: email }, "https://fm.dev");
    await expect(createAcademyWithAdmin(ctx, { academyName: "Outra", adminName: "Rui Lima", adminEmail: email.toUpperCase() }, "https://fm.dev")).rejects.toThrow("Já existe uma conta");
    const again = await resendAdminAccess(ctx, r.academyId, "https://fm.dev");
    expect(await checkResetToken(tokenFrom(r.link))).toBe(false);
    expect(await checkResetToken(tokenFrom(again.link))).toBe(true);
  });
});

describe("convite por e-mail", () => {
  it("envia o link do convite atual e registra na auditoria", async () => {
    const ctx = await newAcademy();
    await sendInviteEmail(ctx, "amigo@conta.dev", "https://fm.dev");
    const invite = await currentInvite(ctx);
    expect(mail.sent.at(-1)).toMatchObject({ to: "amigo@conta.dev" });
    expect(mail.sent.at(-1)!.text).toContain(`https://fm.dev/convite/${invite.token}`);
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctx.academyId), eq(auditLogs.action, "invite.emailed")));
    expect(logs).toHaveLength(1);
  });

  it("entende o código digitado ou o link colado", () => {
    const token = "AbCdEfGhIjKlMnOpQrSt12";
    expect(inviteTokenFrom(token)).toBe(token);
    expect(inviteTokenFrom(` https://fm.dev/convite/${token} `)).toBe(token);
    expect(inviteTokenFrom("curto")).toBeNull();
    expect(inviteTokenFrom("https://fm.dev/outra-coisa")).toBeNull();
  });
});