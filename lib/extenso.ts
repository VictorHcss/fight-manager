/** Valor em reais por extenso, para o recibo: 15090 -> "cento e cinquenta reais e noventa centavos". */
const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function upTo999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest < 20) { if (rest) parts.push(UNITS[rest]); }
  else { parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? ` e ${UNITS[rest % 10]}` : "")); }
  return parts.join(" e ");
}

function integerInWords(n: number): string {
  if (n === 0) return "zero";
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "um milhão" : `${upTo999(millions)} milhões`);
  if (thousands) parts.push(thousands === 1 ? "mil" : `${upTo999(thousands)} mil`);
  if (rest) parts.push(upTo999(rest));
  // "mil e cem", "dois mil e trinta", mas "mil duzentos e trinta"
  const joinLast = rest && (rest < 100 || rest % 100 === 0) && parts.length > 1;
  return joinLast ? `${parts.slice(0, -1).join(" ")} e ${parts[parts.length - 1]}` : parts.join(" ");
}

export function moneyInWords(cents: number): string {
  const reais = Math.floor(cents / 100);
  const c = cents % 100;
  const r = reais ? `${integerInWords(reais)}${reais % 1_000_000 === 0 && reais >= 1_000_000 ? " de" : ""} ${reais === 1 ? "real" : "reais"}` : "";
  const ce = c ? `${integerInWords(c)} ${c === 1 ? "centavo" : "centavos"}` : "";
  return [r, ce].filter(Boolean).join(" e ") || "zero real";
}
