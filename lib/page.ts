import { notFound } from "next/navigation";
import { NotFoundError } from "./errors";

/** Busca um registro da academia; se não existir (ou for de outra academia), mostra a página 404. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}

/** Valida parâmetros da URL: IDs precisam ser UUID (evita erro do banco com texto qualquer). */
export const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
