"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card empty" role="alert">
      <strong>Algo deu errado ao carregar esta página.</strong>
      <p>Pode ser uma instabilidade momentânea no banco de dados. Seus dados não foram alterados.</p>
      <button type="button" className="btn btn--primary" onClick={reset}>Tentar de novo</button>
    </div>
  );
}
