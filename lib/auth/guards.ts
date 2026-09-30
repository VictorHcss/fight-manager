/**
 * Portões de acesso. Toda página e toda Server Action chama um destes antes de
 * qualquer coisa; o contexto devolvido é o que os serviços exigem.
 */
import { redirect } from "next/navigation";
import type { AcademyContext, PlatformContext } from "@/services/context";
import type { StudentContext } from "@/services/student-portal";
import { currentUser, type SessionUser } from "./session";

export async function requireAcademyAdmin(): Promise<AcademyContext & { user: SessionUser }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "PLATFORM_ADMIN") redirect("/plataforma");
  if (user.role === "STUDENT") redirect("/aluno");
  if (user.role !== "ACADEMY_ADMIN" || !user.academyId) redirect("/login?erro=sem-acesso");
  return { userId: user.id, academyId: user.academyId, role: "ACADEMY_ADMIN", user };
}

export async function requirePlatformAdmin(): Promise<PlatformContext & { user: SessionUser }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "PLATFORM_ADMIN") redirect("/");
  return { userId: user.id, role: "PLATFORM_ADMIN", user };
}

/** Área do aluno: só a conta STUDENT, e os serviços ainda conferem o vínculo de cada dado. */
export async function requireStudent(): Promise<StudentContext & { user: SessionUser }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "STUDENT") redirect(user.role === "PLATFORM_ADMIN" ? "/plataforma" : "/");
  return { userId: user.id, role: "STUDENT", user };
}
