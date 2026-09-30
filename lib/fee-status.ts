import { today } from "./dates";

export type DisplayFeeStatus = "pending" | "overdue" | "paid" | "canceled";

export const FEE_STATUS_LABEL: Record<DisplayFeeStatus, string> = {
  pending: "A vencer",
  overdue: "Atrasada",
  paid: "Paga",
  canceled: "Cancelada",
};

/** "Atrasada" é calculado: pendente com vencimento antes de hoje (fuso de Brasília). */
export function displayFeeStatus(status: "pending" | "paid" | "canceled", dueDate: string, now: string = today()): DisplayFeeStatus {
  if (status === "pending" && dueDate < now) return "overdue";
  return status;
}
