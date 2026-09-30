/** Paginação das listas: a página vem da URL (?pagina=2) e é sempre um número válido. */
export const PAGE_SIZE = 50;

export function pageFrom(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 100000 ? n : 1;
}

export const offsetOf = (page: number, size = PAGE_SIZE) => (page - 1) * size;

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pages: number;
}

export const pagesOf = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));
