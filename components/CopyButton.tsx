"use client";

import { useState } from "react";

/** Copia um texto (ex.: Pix copia e cola) e confirma na própria etiqueta do botão. */
export function CopyButton({ text, label = "Copiar", className = "btn btn--primary" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className={className} aria-live="polite" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch { return; }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }}>{copied ? "Copiado!" : label}</button>
  );
}
