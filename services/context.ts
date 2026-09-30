/**
 * Contexto de quem está agindo. Toda função de serviço de academia recebe um
 * AcademyContext e filtra TODAS as consultas por academyId. Não existe função
 * que busque um aluno só pelo ID: trocar um ID na URL nunca atravessa academias.
 */
export interface AcademyContext {
  userId: string;
  academyId: string;
  role: "ACADEMY_ADMIN";
}

export interface PlatformContext {
  userId: string;
  role: "PLATFORM_ADMIN";
}
