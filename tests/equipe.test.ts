// Equipe e plataforma: suspender e reativar academias, permissões da equipe.
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { newAcademy } from "./helpers";
import { db } from "@/db";
import { academies, auditLogs, sessions, users } from "@/db/schema";
import { createAcademyAdmin, setAcademyActive, updateUserPermissions } from "@/services/users";

const platform = async () => {
  const [u] = await db.insert(users).values({ academyId: null, role: "PLATFORM_ADMIN", name: "Plataforma", email: `plat${Date.now()}${Math.random()}@p.dev`, passwordHash: "x" }).returning();
  return { userId: u.id, role: "PLATFORM_ADMIN" as const };
};

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

describe("equipe com permissões", () => {
  it("cria membro com acesso personalizado, altera e audita; ninguém altera o próprio acesso", async () => {
    const ctx = await newAcademy("Equipe");
    const u = await createAcademyAdmin(ctx, { name: "Camila Duarte", email: `camila${Date.now()}@e.dev`, password: "senha-da-camila" }, ["alunos", "pagamentos"]);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row.permissions).toEqual(["alunos", "pagamentos"]);
    await updateUserPermissions(ctx, u.id, null);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.permissions).toBeNull();
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, u.id));
    expect(logs.some((l) => l.action === "user.permissions_changed")).toBe(true);
    await expect(updateUserPermissions(ctx, ctx.userId, ["alunos"])).rejects.toThrow("próprio acesso");
  });

  it("não altera membro de outra academia", async () => {
    const a = await newAcademy("A");
    const b = await newAcademy("B");
    await expect(updateUserPermissions(a, b.userId, ["alunos"])).rejects.toThrow();
  });
});
