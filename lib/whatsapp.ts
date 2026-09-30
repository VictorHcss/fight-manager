import { formatDate, formatReference } from "./dates";
import { formatMoney } from "./money";

/**
 * Link para abrir o WhatsApp com uma mensagem pronta (wa.me). Não é integração:
 * nada é enviado pelo sistema; a pessoa revisa e envia pelo próprio WhatsApp.
 * Devolve null se o telefone não parecer um celular brasileiro válido.
 */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return `https://wa.me/55${digits}?text=${encodeURIComponent(text)}`;
}

/** `student` preenchido quando a mensagem vai para o responsável: "a mensalidade de Pedro". */
export function reminderText(opts: { name: string; student?: string; academy: string; reference?: string; dueDate?: string; openCents?: number; overdue?: boolean }): string {
  const first = opts.name.split(" ")[0];
  const of = opts.student ? ` de ${opts.student.split(" ")[0]}` : "";
  if (!opts.reference || !opts.openCents) return `Olá, ${first}! Aqui é da ${opts.academy}.`;
  const when = opts.overdue ? `venceu em ${formatDate(opts.dueDate)}` : `vence em ${formatDate(opts.dueDate)}`;
  return `Olá, ${first}! Aqui é da ${opts.academy}. A mensalidade${of} de ${formatReference(opts.reference)} (${formatMoney(opts.openCents)} em aberto) ${when}. Qualquer dúvida, estamos à disposição.`;
}
