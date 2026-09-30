import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, sessions, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { DomainError, NotFoundError } from "@/lib/errors";
import type { z } from "zod";
import type { userInput } from "@/lib/validation";
import { TEST_ACCOUNTS } from "@/lib/test-accounts";
import { audit } from "./audit";
import type { AcademyContext, PlatformContext } from "./context";

export async function listAcademyUsers(ctx: AcademyContext) {
  return db.select({ id: users.id, name: users.name, email: users.email, active: users.active, createdAt: users.createdAt })
    .from(users).where(and(eq(users.academyId, ctx.academyId), eq(users.role, "ACADEMY_ADMIN"))).orderBy(asc(users.name));
}

export async function createAcademyAdmin(ctx: AcademyContext, data: z.output<typeof userInput>) {
  const [exists] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${data.email}`);
  if (exists) throw new DomainError("Já existe um usuário com esse e-mail.", { email: "E-mail já cadastrado." });
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        academyId: ctx.academyId, role: "ACADEMY_ADMIN", name: data.name, email: data.email, passwordHash: await hashPassword(data.password),
      }).returning({ id: users.id, name: users.name });
      await audit(tx, ctx, "user.created", "user", user.id, `Administrador criado: ${user.name}`);
      return user;
    });
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e.code === "23505" || e.cause?.code === "23505") throw new DomainError("Já existe um usuário com esse e-mail.", { email: "E-mail já cadastrado." });
    throw error;
  }
}

export async function setUserActive(ctx: AcademyContext, id: string, active: boolean) {
  if (id === ctx.userId) throw new DomainError("Você não pode desativar o seu próprio acesso.");
  return db.transaction(async (tx) => {
    const [user] = await tx.update(users).set({ active }).where(and(eq(users.id, id), eq(users.academyId, ctx.academyId))).returning({ id: users.id, name: users.name });
    if (!user) throw new NotFoundError("Usuário");
    if (!active) await tx.delete(sessions).where(eq(sessions.userId, id)); // sai de todos os aparelhos na hora
    await audit(tx, ctx, active ? "user.activated" : "user.deactivated", "user", id, `Acesso de ${user.name} ${active ? "reativado" : "desativado"}`);
    return user;
  });
}

export async function changePassword(userId: string, academyId: string | null, current: string, next: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !(await verifyPassword(current, user.passwordHash))) throw new DomainError("Senha atual incorreta.", { current: "Senha atual incorreta." });
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId));
    // encerra todas as sessões da conta; a ação cria logo em seguida uma nova para quem trocou
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await audit(tx, { userId, academyId }, "user.password_changed", "user", userId, `${user.name} trocou a senha`);
  });
}

/**
 * Visão da plataforma: só dados agregados das academias. O administrador da
 * plataforma não vê alunos, pagamentos nem dados pessoais (menor privilégio).
 */
export async function listAcademiesOverview(_ctx: PlatformContext) {
  return db.select({
    id: academies.id, name: academies.name, active: academies.active, createdAt: academies.createdAt,
    students: sql<number>`(select count(*)::int from students s where s.academy_id = academies.id and s.status = 'active')`,
    admins: sql<number>`(select count(*)::int from users u where u.academy_id = academies.id and u.role = 'ACADEMY_ADMIN' and u.active)`,
    // e-mail do responsável (primeiro administrador ativo): é para ele que vai o link de acesso
    adminEmail: sql<string | null>`(select u.email from users u where u.academy_id = academies.id and u.role = 'ACADEMY_ADMIN' and u.active order by u.created_at limit 1)`,
  }).from(academies).orderBy(asc(academies.name));
}

/** Contas de teste do seed que existem neste banco (para a tela de login de desenvolvimento). */
export async function existingTestAccounts() {
  const rows = await db.select({ email: users.email }).from(users)
    .where(and(inArray(sql`lower(${users.email})`, TEST_ACCOUNTS.map((a) => a.email)), eq(users.active, true)));
  const found = new Set(rows.map((r) => r.email.toLowerCase()));
  return TEST_ACCOUNTS.filter((a) => found.has(a.email));
}
