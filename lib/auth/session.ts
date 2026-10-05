/**
 * Sessões no banco. O navegador guarda só um token aleatório (cookie httpOnly);
 * o banco guarda o hash SHA-256 desse token. Se o banco vazar, as sessões não servem.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { academies, sessions, users } from "@/db/schema";
import { isPermission, type Permission } from "@/lib/permissions";

export const SESSION_COOKIE = "fm_session";
const SESSION_DAYS = 7;

/** Cookie só por HTTPS em produção. COOKIE_SECURE=false permite testar em rede local sem HTTPS. */
const cookieSecure = () => (process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production");

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.insert(sessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date())); // limpeza das vencidas
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", expires: expiresAt,
  });
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "PLATFORM_ADMIN" | "ACADEMY_ADMIN" | "STUDENT";
  academyId: string | null;
  academyName: string | null;
  academyTimezone: string | null;
  permissions: Permission[] | null;
  emailVerified: boolean;
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select({
    id: users.id, name: users.name, email: users.email, role: users.role, academyId: users.academyId, academyName: academies.name,
    academyTimezone: academies.timezone, permissions: users.permissions, emailVerifiedAt: users.emailVerifiedAt,
  }).from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(academies, eq(academies.id, users.academyId))
    .where(and(
      eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true),
      sql`(${users.academyId} is null or ${academies.active} = true)`, // academia suspensa não entra
    ));
  if (!row) return null;
  const { emailVerifiedAt, permissions, ...rest } = row;
  return { ...rest, permissions: permissions ? permissions.filter(isPermission) : null, emailVerified: !!emailVerifiedAt };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
}
