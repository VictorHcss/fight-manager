import type { z } from "zod";
import { DomainError } from "./errors";
import { fieldErrors, formToObject } from "./validation";

/** Estado devolvido pelas Server Actions para os formulários. */
export interface ActionState {
  message?: string;
  errors?: Record<string, string>;
  values?: Record<string, string>;
}

/**
 * Valida o formulário no servidor e executa a ação. Erros de regra de negócio
 * viram mensagens para o usuário; erros inesperados são registrados no log e
 * aparecem como uma mensagem genérica (sem vazar detalhes internos).
 */
export async function handleForm<S extends z.ZodType>(form: FormData, schema: S, run: (data: z.output<S>) => Promise<void>): Promise<ActionState> {
  const values = formToObject(form);
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { message: "Confira os campos destacados.", errors: fieldErrors(parsed.error), values };
  try {
    await run(parsed.data);
    return {};
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (error instanceof DomainError) return { message: error.message, errors: error.fieldErrors, values };
    console.error(error);
    return { message: "Não foi possível salvar agora. Tente de novo em instantes.", values };
  }
}

/** redirect() do Next funciona lançando um erro especial, que precisa seguir adiante. */
export function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

/** Só aceita caminhos internos (evita redirecionar para outro site). */
export function safeBack(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

export function withFlash(path: string, code: string): string {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set("ok", code);
  params.delete("erro");
  return `${base}?${params.toString()}`;
}
