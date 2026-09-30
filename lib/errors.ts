/** Erro de regra de negócio: a mensagem é segura para mostrar ao usuário. */
export class DomainError extends Error {
  constructor(message: string, public readonly fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what = "Registro") {
    super(`${what} não encontrado.`);
    this.name = "NotFoundError";
  }
}

/** Violação de unicidade do PostgreSQL (ex.: duas pessoas usando o mesmo e-mail ao mesmo tempo). */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: unknown } | null;
  return !!e && (e.code === "23505" || (e.cause !== undefined && isUniqueViolation(e.cause)));
}
