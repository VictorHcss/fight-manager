/** Iniciais para o avatar: "Victor Almeida" → "VA". Serve no servidor e no navegador. */
export const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
