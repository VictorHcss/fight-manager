import { db } from "@/db";
import { academies, modalities, users } from "@/db/schema";
import type { AcademyContext } from "@/services/context";
import { createStudent } from "@/services/students";

let n = 0;

/** Cria uma academia isolada com um administrador: cada teste tem seus próprios dados. */
export async function newAcademy(name = "Academia Teste"): Promise<AcademyContext> {
  n++;
  const [academy] = await db.insert(academies).values({ name: `${name} ${n}` }).returning();
  const [admin] = await db.insert(users).values({ academyId: academy.id, role: "ACADEMY_ADMIN", name: "Admin", email: `admin${n}-${Date.now()}@teste.dev`, passwordHash: "x" }).returning();
  const [modality] = await db.insert(modalities).values({ academyId: academy.id, name: "Boxe", defaultFeeCents: 15000 }).returning();
  modalityByAcademy.set(academy.id, modality.id);
  return { userId: admin.id, academyId: academy.id, role: "ACADEMY_ADMIN" };
}

const modalityByAcademy = new Map<string, string>();
export const modalityOf = (ctx: AcademyContext) => modalityByAcademy.get(ctx.academyId)!;

const NO_EXTRAS = {
  cpf: null, zip: null, street: null, number: null, complement: null, district: null, city: null, state: null,
  emergencyName: null, emergencyPhone: null, emergencyRelation: null, imageConsent: null,
  guardianId: null, guardianName: null, guardianCpf: null, guardianPhone: null, guardianEmail: null, guardianRelationship: null,
};

/** Dados de um aluno adulto, na modalidade padrão da academia de teste. */
export function studentData(ctx: AcademyContext, overrides: Partial<Parameters<typeof createStudent>[1]> = {}): Parameters<typeof createStudent>[1] {
  return {
    name: "Victor Almeida", phone: "(33) 99812-4410", email: "victor@exemplo.dev", birthDate: "1995-04-10", modalityId: modalityOf(ctx),
    joinedAt: "2026-01-10", status: "active" as const, monthlyFee: 15000, dueDay: 10, notes: null, ...NO_EXTRAS, ...overrides,
  };
}
