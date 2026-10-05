import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { academies, users } from "@/db/schema";
import { checkCredentials } from "@/lib/auth/login";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { eq } from "drizzle-orm";

describe("autenticação", () => {
  it("senha guardada com hash e conferida", async () => {
    const hash = await hashPassword("minha-senha-forte");
    expect(hash).not.toContain("minha-senha-forte");
    expect(await verifyPassword("minha-senha-forte", hash)).toBe(true);
    expect(await verifyPassword("errada", hash)).toBe(false);
  });

  it("login: credenciais, usuário inativo, academia suspensa e limite de tentativas", async () => {
    const [academy] = await db.insert(academies).values({ name: "Academia Login" }).returning();
    await db.insert(users).values({ academyId: academy.id, role: "ACADEMY_ADMIN", name: "Ana", email: "ana@login.dev", passwordHash: await hashPassword("senha-da-ana-123") });

    expect(await checkCredentials("ANA@login.dev", "senha-da-ana-123")).toMatchObject({ ok: true, role: "ACADEMY_ADMIN" });
    expect(await checkCredentials("ana@login.dev", "errada")).toEqual({ ok: false, message: "E-mail ou senha incorretos." });
    expect(await checkCredentials("ninguem@login.dev", "x")).toEqual({ ok: false, message: "E-mail ou senha incorretos." });

    await db.update(academies).set({ active: false }).where(eq(academies.id, academy.id));
    expect((await checkCredentials("ana@login.dev", "senha-da-ana-123")).ok).toBe(false);

    for (let i = 0; i < 6; i++) await checkCredentials("bloqueio@login.dev", "x");
    expect(await checkCredentials("bloqueio@login.dev", "x")).toEqual({ ok: false, message: "Muitas tentativas. Aguarde 15 minutos e tente de novo." });
  });
});
