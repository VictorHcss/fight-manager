/**
 * Portões de acesso. Toda página e toda Server Action chama um destes antes de
 * qualquer coisa; o contexto devolvido é o que os serviços exigem.
 */
import { redirect } from "next/navigation";
import type { AcademyContext, PlatformContext } from "@/services/context";
import type { StudentContext } from "@/services/student-portal";
import { currentUser, type SessionUser } from "./session";
import { TIMEZONE } from "@/lib/dates";
import { can, hasFullAccess, PERMISSION_HOME, type Permission, type PermissionSet } from "@/lib/permissions";

/**
 * Equipe da academia. Com `permission`, também confere se a pessoa tem aquela permissão;
 * sem ela, volta para a primeira área liberada com um aviso. "full" exige acesso total
 * (gerenciar a equipe).
 */
export async function requireAcademyAdmin(permission?: Permission | "full"): Promise<AcademyContext & { user: SessionUser; permissions: Permission[] | null; timezone: string }> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "PLATFORM_ADMIN") redirect("/plataforma");
  if (user.role === "STUDENT") redirect("/aluno");
  if (user.role !== "ACADEMY_ADMIN" || !user.academyId) redirect("/login?erro=sem-acesso");
  const allowed = permission === undefined ? true : permission === "full" ? hasFullAccess(user.permissions) : can(user.permissions, permission);
  if (!allowed) redirect(`${firstArea(user.permissions)}?erro=${encodeURIComponent("Você não tem permissão para acessar essa área. Fale com o responsável pela academia.")}`);
  return { userId: user.id, academyId: user.academyId, role: "ACADEMY_ADMIN", user, permissions: user.permissions, timezone: user.academyTimezone ?? TIMEZONE };
}

/** Início para quem tem acesso total ou a mensalidades; senão, a primeira área liberada. */
export function firstArea(p: PermissionSet): string {
  if (hasFullAccess(p) || p!.includes("mensalidades")) return "/";
  return p!.length ? PERMISSION_HOME[p![0]] : "/sem-acesso";
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
