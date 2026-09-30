/**
 * Dinheiro em centavos inteiros. A conversão de texto é feita por texto,
 * sem passar por ponto flutuante: "150,90" vira 15090 exatamente.
 */
const MAX_CENTS = 100_000_000_00; // R$ 100 milhões: limite de sanidade

export function parseMoney(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let text = String(input).trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!text) return null;
  // "1.234,56" (padrão brasileiro) ou "1234.56"
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

export function formatMoney(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${reais},${String(abs % 100).padStart(2, "0")}`;
}

/** Valor para preencher um campo de formulário: 15090 -> "150,90". */
export function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}
