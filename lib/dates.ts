/**
 * Datas de negócio (vencimento, pagamento) são "datas de calendário" no formato
 * YYYY-MM-DD, sempre no fuso de Brasília. Assim uma mensalidade que vence hoje
 * não aparece como atrasada às 21h só porque em UTC já é amanhã.
 */
export const TIMEZONE = process.env.APP_TIMEZONE || "America/Sao_Paulo";

export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function currentReference(now: Date = new Date()): string {
  return today(now).slice(0, 7);
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidReference(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Dia de vencimento dentro do mês de referência (dia 31 em fevereiro vira o último dia). */
export function dueDateFor(reference: string, dueDay: number): string {
  const [y, m] = reference.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${reference}-${String(Math.min(Math.max(1, dueDay), last)).padStart(2, "0")}`;
}

/**
 * Próximo vencimento a partir de hoje para um dia de vencimento: se o dia deste mês
 * já passou, sugere o do mês seguinte. Usado só como sugestão nos formulários.
 */
export function nextDueDate(dueDay: number, now: string = today()): { reference: string; dueDate: string } {
  const reference = now.slice(0, 7);
  const thisMonth = dueDateFor(reference, dueDay);
  if (thisMonth >= now) return { reference, dueDate: thisMonth };
  const [y, m] = reference.split("-").map(Number);
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
  return { reference: next, dueDate: dueDateFor(next, dueDay) };
}

export function monthRange(reference: string): { from: string; to: string } {
  const [y, m] = reference.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${reference}-01`, to: `${reference}-${String(last).padStart(2, "0")}` };
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "–";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function formatReference(reference: string): string {
  const [y, m] = reference.split("-").map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIMEZONE, dateStyle: "short", timeStyle: "short" }).format(value);
}
