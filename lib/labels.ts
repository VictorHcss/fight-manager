export const PAYMENT_METHODS = { cash: "Dinheiro", pix: "PIX", debit: "Cartão de débito", credit: "Cartão de crédito", other: "Outro" } as const;
export const PAYMENT_STATUS = { paid: "Pago", pending: "Aguardando confirmação", canceled: "Cancelado" } as const;
export const STUDENT_STATUS = { active: "Ativo", inactive: "Inativo", pending: "Aguardando aprovação", rejected: "Recusado", suspended: "Suspenso" } as const;

/** Categorias de lançamento manual. "Mensalidade" não existe aqui: ela entra automaticamente pelo pagamento. */
export const INCOME_CATEGORIES = ["Matrícula", "Outros recebimentos"] as const;
export const EXPENSE_CATEGORIES = ["Equipamentos", "Manutenção", "Infraestrutura", "Despesas operacionais", "Outras despesas"] as const;
export const AUTO_CATEGORIES = { fee: "Mensalidade", loose: "Pagamento avulso" } as const;
