/** Esqueletos de carregamento no formato da tela que vai aparecer. */
export function ListSkeleton({ rows = 6, filters = true }: { rows?: number; filters?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ width: "30%", height: "1.8rem", marginBottom: "1.4rem" }} />
      {filters && <div className="skeleton" style={{ height: "2.8rem", marginBottom: "1rem" }} />}
      <div className="card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-row"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ width: "25%", height: "1.8rem", marginBottom: "1.4rem" }} />
      <div className="attention">{[1, 2, 3].map((i) => <div key={i} className="attention-card"><div className="skeleton" /><div className="skeleton" style={{ height: "2rem", width: "40%" }} /></div>)}</div>
      <div className="card">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton-row"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>)}</div>
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ width: "35%", height: "1.8rem", marginBottom: "1.4rem" }} />
      <div className="card">{[1, 2, 3, 4].map((i) => <div key={i} style={{ marginBottom: "1rem" }}><div className="skeleton" style={{ width: "25%", marginBottom: "0.4rem" }} /><div className="skeleton" style={{ height: "2.6rem" }} /></div>)}</div>
    </div>
  );
}
