import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { academies, users } from "@/db/schema";
import { dummyHash, verifyPassword } from "./password";

// Limite simples de tentativas por e-mail (em memória, por instância do servidor)
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

export type LoginResult = { ok: true; userId: string; role: string } | { ok: false; message: string };

export async function checkCredentials(emailInput: string, password: string, now = Date.now()): Promise<LoginResult> {
  const email = emailInput.trim().toLowerCase();
  const tries = attempts.get(email);
  if (tries && tries.until > now && tries.count >= MAX_ATTEMPTS) {
    return { ok: false, message: "Muitas tentativas. Aguarde 15 minutos e tente de novo." };
  }
  const [user] = await db.select({ id: users.id, role: users.role, hash: users.passwordHash, active: users.active, academyActive: academies.active })
    .from(users).leftJoin(academies, eq(academies.id, users.academyId)).where(sql`lower(${users.email}) = ${email}`);

  // compara mesmo quando o usuário não existe: o tempo de resposta não revela quais e-mails existem
  const valid = await verifyPassword(password, user?.hash ?? dummyHash());
  if (!user || !valid || !user.active || user.academyActive === false) {
    const current = tries && tries.until > now ? tries : { count: 0, until: now + WINDOW_MS };
    attempts.set(email, { count: current.count + 1, until: current.until });
    return { ok: false, message: "E-mail ou senha incorretos." };
  }
  attempts.delete(email);
  return { ok: true, userId: user.id, role: user.role };
}
