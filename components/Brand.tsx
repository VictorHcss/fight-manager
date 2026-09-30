/** Marca do Fight Manager: um símbolo geométrico simples (luva estilizada) e o nome. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path d="M10 21v-7.5a3.5 3.5 0 0 1 3.5-3.5h4a4.5 4.5 0 0 1 4.5 4.5V18a3 3 0 0 1-3 3z" fill="#fff" />
      <path d="M10 21h9v2.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5z" fill="#fff" opacity=".7" />
      <path d="M14 14.5h4.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <span className="brand">
      <BrandMark />
      <span className="brand-text">
        <span className="brand-name">Fight Manager</span>
        {subtitle && <small>{subtitle}</small>}
      </span>
    </span>
  );
}
