// Área do aluno e do responsável: telefone, contato da academia, confirmação de e-mail e acesso do responsável.
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newAcademy, studentData } from "./helpers";
import { db } from "@/db";
import { academies, auditLogs, emailVerifications, students, users } from "@/db/schema";
import { memoryMailer, useMailer } from "@/lib/email";
import { ownContactInput } from "@/lib/validation";
import { confirmEmail, isEmailVerified, sendEmailVerification } from "@/services/email-verification";
import { dependentsOf, grantGuardianAccess, revokeGuardianAccess } from "@/services/guardian-access";
import { guardiansOf } from "@/services/guardians";
import { ownAccount, studentOverview, updateOwnPhone } from "@/services/student-portal";
import { createStudent } from "@/services/students";

const studentAccount = async () => {
  const [u] = await db.insert(users).values({ academyId: null, role: "STUDENT", name: "Lara Nunes", email: `lara${Date.now()}${Math.random()}@a.dev`, passwordHash: "x" }).returning();
  return { userId: u.id, role: "STUDENT" as const };
};

let mail: ReturnType<typeof memoryMailer>;
beforeEach(() => { mail = memoryMailer(); useMailer(mail); });
afterEach(() => useMailer(null));

describe("telefone pela área do aluno", () => {
  it("valida o telefone com DDD", () => {
    expect(ownContactInput.safeParse({ phone: "9999-1234" }).success).toBe(false);
    expect(ownContactInput.safeParse({ phone: "(33) 99812-4410" }).success).toBe(true);
  });

  it("atualiza a conta e só os vínculos ativos, com auditoria em cada academia", async () => {
    const me = await studentAccount();
    const ctxA = await newAcademy("A");
    const ctxB = await newAcademy("B");
    const sA = await createStudent(ctxA, studentData(ctxA));
    const sB = await createStudent(ctxB, studentData(ctxB, { status: "inactive" }));
    await db.update(students).set({ userId: me.userId }).where(eq(students.id, sA.id));
    await db.update(students).set({ userId: me.userId }).where(eq(students.id, sB.id));

    await updateOwnPhone(me, "(33) 98888-7777");
    const [a] = await db.select().from(students).where(eq(students.id, sA.id));
    const [b] = await db.select().from(students).where(eq(students.id, sB.id));
    expect(a.phone).toBe("(33) 98888-7777");
    expect(b.phone).toBe(studentData(ctxB).phone); // vínculo inativo não muda
    expect((await ownAccount(me)).phone).toBe("(33) 98888-7777");
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctxA.academyId), eq(auditLogs.action, "student.contact_updated")));
    expect(logs).toHaveLength(1);
  });

  it("a visão do aluno traz o contato da academia", async () => {
    const me = await studentAccount();
    const ctx = await newAcademy("Contato");
    await db.update(academies).set({ phone: "(33) 3271-0000" }).where(eq(academies.id, ctx.academyId));
    const s = await createStudent(ctx, studentData(ctx));
    await db.update(students).set({ userId: me.userId }).where(eq(students.id, s.id));
    const { me: view } = await studentOverview(me, s.id);
    expect(view.academyPhone).toBe("(33) 3271-0000");
  });
});

describe("confirmação de e-mail", () => {
  it("envia link, confirma uma vez e aceita abrir de novo depois de confirmado", async () => {
      const [u] = await db.insert(users).values({ academyId: null, role: "STUDENT", name: "Lara Nunes", email: `lara${Date.now()}@v.dev`, passwordHash: "x" }).returning();
      expect(await sendEmailVerification(u.id, "http://localhost:3000")).toBe(true);
      const token = mail.sent.at(-1)!.text.match(/confirmar-email\/([A-Za-z0-9_-]+)/)![1];
      expect(await isEmailVerified(u.id)).toBe(false);
      await confirmEmail(token);
      expect(await isEmailVerified(u.id)).toBe(true);
      await expect(confirmEmail(token)).resolves.toMatchObject({ name: "Lara Nunes" });
      expect(await sendEmailVerification(u.id, "http://localhost:3000")).toBe(false); // já confirmado
      await expect(confirmEmail("token-invalido-token-invalido-token-invalido-xx")).rejects.toThrow();
      expect((await db.select().from(emailVerifications).where(eq(emailVerifications.userId, u.id))).length).toBe(1);
  });
});

describe("área do responsável", () => {
  it("cria a conta, envia o link, mostra o dependente e respeita a remoção", async () => {
    const ctx = await newAcademy("Responsável");
    const email = `mae${Date.now()}@r.dev`;
    const s = await createStudent(ctx, studentData(ctx, { name: "Pedro Henrique Souza", birthDate: "2015-03-02", email: null,
      guardianName: "Juliana Souza", guardianPhone: "(33) 99811-2233", guardianEmail: email, guardianRelationship: "mãe" }));
    const [{ id: guardianId }] = await guardiansOf(ctx, s.id);

    const r = await grantGuardianAccess(ctx, guardianId, "http://x");
    expect(r.created).toBe(true);
    expect(mail.sent.at(-1)!.text).toContain("/redefinir-senha/");
    const [u] = await db.select().from(users).where(eq(users.id, r.userId));
    expect(u.role).toBe("STUDENT");
    expect((await dependentsOf(r.userId)).map((d) => d.id)).toEqual([s.id]);
    const view = await studentOverview({ userId: r.userId, role: "STUDENT" }, s.id);
    expect(view.me.name).toBe("Pedro Henrique Souza");

    await revokeGuardianAccess(ctx, guardianId);
    expect(await dependentsOf(r.userId)).toEqual([]);
    await expect(studentOverview({ userId: r.userId, role: "STUDENT" }, s.id)).rejects.toThrow();
  });

  it("não usa e-mail de conta da equipe", async () => {
    const ctx = await newAcademy("Equipe");
    const [admin] = await db.select().from(users).where(eq(users.id, ctx.userId));
    const s = await createStudent(ctx, studentData(ctx, { birthDate: "2014-01-01", guardianName: "Marcos Lima", guardianPhone: "(33) 99811-0000", guardianEmail: admin.email, guardianRelationship: "pai" }));
    const g = (await guardiansOf(ctx, s.id))[0];
    await expect(grantGuardianAccess(ctx, g.id, "http://x")).rejects.toThrow("equipe");
  });
});
