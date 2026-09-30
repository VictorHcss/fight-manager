import Link from "next/link";

/** "Mostrando 51–100 de 234" com anterior/próxima, preservando os filtros da URL. */
export function Pagination({ page, pages, total, size, params, path }: {
  page: number; pages: number; total: number; size: number; params: Record<string, string | undefined>; path: string;
}) {
  if (total === 0) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries(params).filter(([k, v]) => v && k !== "pagina" && k !== "ok" && k !== "erro") as [string, string][]);
    if (p > 1) q.set("pagina", String(p));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <nav className="pagination" aria-label="Páginas">
      <span className="muted small">Mostrando {from}–{to} de {total}</span>
      {pages > 1 && (
        <span className="pagination-links">
          {page > 1 ? <Link href={href(page - 1)} className="btn btn--small">Anterior</Link> : <span className="btn btn--small is-disabled" aria-disabled="true">Anterior</span>}
          <span className="small">Página {page} de {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="btn btn--small">Próxima</Link> : <span className="btn btn--small is-disabled" aria-disabled="true">Próxima</span>}
        </span>
      )}
    </nav>
  );
}
