// v0.8: exportação CSV, suspensão de academias pela plataforma e telefone editado pelo próprio aluno.
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { academies, auditLogs, sessions, students, users } from "@/db/schema";
import { csvMoney, toCsv } from "@/lib/csv";
import { ownContactInput } from "@/lib/validation";
import { ownAccount, studentOverview, updateOwnPhone } from "@/services/student-portal";
import { createStudent } from "@/services/students";
import { setAcademyActive } from "@/services/users";
import { newAcademy, studentData } from "./helpers";

const platform = async () => {
  const [u] = await db.insert(users).values({ academyId: null, role: "PLATFORM_ADMIN", name: "Plataforma", email: `plat${Date.now()}${Math.random()}@p.dev`, passwordHash: "x" }).returning();
  return { userId: u.id, role: "PLATFORM_ADMIN" as const };
};
const studentAccount = async () => {
  const [u] = await db.insert(users).values({ academyId: null, role: "STUDENT", name: "Lara Nunes", email: `lara${Date.now()}${Math.random()}@a.dev`, passwordHash: "x" }).returning();
  return { userId: u.id, role: "STUDENT" as const };
};

describe("CSV", () => {
  it("usa ponto e vírgula, BOM, aspas quando precisa e valores em reais com vírgula", () => {
    const csv = toCsv(["Nome", "Valor"], [["Silva; Ana", csvMoney(123456)], ['Diz "oi"', csvMoney(-500)], [null, undefined]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Silva; Ana";1234,56');
    expect(csv).toContain('"Diz ""oi""";-5,00');
    expect(csv.trim().split("\r\n")).toHaveLength(4);
  });
});

describe("suspender e reativar academia", () => {
  it("suspende, derruba as sessões dos administradores, audita e reativa", async () => {
    const ctx = await newAcademy("Suspensa");
    const plat = await platform();
    await db.insert(sessions).values({ userId: ctx.userId, tokenHash: `t${Date.now()}${Math.random()}`.padEnd(64, "0").slice(0, 64), expiresAt: new Date(Date.now() + 86_400_000) });

    await setAcademyActive(plat, ctx.academyId, false);
    const [a] = await db.select().from(academies).where(eq(academies.id, ctx.academyId));
    expect(a.active).toBe(false);
    expect(await db.select().from(sessions).where(eq(sessions.userId, ctx.userId))).toHaveLength(0);
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.academyId, ctx.academyId), eq(auditLogs.action, "academy.suspended")));
    expect(logs).toHaveLength(1);

    await setAcademyActive(plat, ctx.academyId, true);
    const [b] = await db.select().from(academies).where(eq(academies.id, ctx.academyId));
    expect(b.active).toBe(true);
  });

  it("academia inexistente vira erro de não encontrado", async () => {
    await expect(setAcademyActive(await platform(), "00000000-0000-4000-8000-000000000000", false)).rejects.toThrow();
  });
});

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
