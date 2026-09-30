import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className = "", id }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(title || actions) && <div className="card-head">{title && <h2>{title}</h2>}{actions}</div>}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone, href }: { label: string; value: string | number; hint?: string; tone?: "danger" | "warn" | "ok"; href?: string }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <strong className={tone ? `tone-${tone}` : undefined}>{value}</strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  return href ? <Link href={href} className="stat stat--link">{body}</Link> : <div className="stat">{body}</div>;
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  paid: "ok", active: "ok", income: "ok",
  pending: "warn",
  overdue: "danger", expense: "danger",
  canceled: "muted", inactive: "muted",
};

export function Badge({ status, children }: { status: string; children: ReactNode }) {
  return <span className={`badge badge--${BADGE_TONES[status] ?? "muted"}`}>{children}</span>;
}

export function Alert({ tone, children }: { tone: "ok" | "danger" | "info"; children: ReactNode }) {
  return <div className={`alert alert--${tone}`} role={tone === "danger" ? "alert" : "status"}>{children}</div>;
}

export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className={`field${error ? " has-error" : ""}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && <small className="field-error" id={`${name}-error`}>{error}</small>}
    </div>
  );
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="dl">
      {items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "–"}</dd></div>)}
    </dl>
  );
}
