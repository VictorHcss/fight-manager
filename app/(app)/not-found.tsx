import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card empty">
      <strong>Não encontramos o que você procurava.</strong>
      <p>O registro pode ter sido removido, ou não pertence à sua academia.</p>
      <Link href="/" className="btn">Voltar ao dashboard</Link>
    </div>
  );
}
