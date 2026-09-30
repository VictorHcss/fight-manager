import { describe, expect, it } from "vitest";
import { dueDateFor, isValidDate, nextDueDate, today } from "@/lib/dates";
import { displayFeeStatus } from "@/lib/fee-status";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { entryInput, feeInput, studentInput } from "@/lib/validation";

describe("valores monetários", () => {
  it.each([["150", 15000], ["150,9", 15090], ["150,90", 15090], ["1.234,56", 123456], ["R$ 99,99", 9999], ["0,10", 10], ["1234.5", 123450]])("%s -> %i centavos", (input, cents) => {
    expect(parseMoney(input)).toBe(cents);
  });
  it.each(["", "abc", "10,999", "-5", "1,2,3", "1e5"])("recusa %s", (input) => expect(parseMoney(input)).toBeNull());
  it("não perde centavos em somas (o clássico 0,1 + 0,2)", () => {
    expect(parseMoney("0,10")! + parseMoney("0,20")!).toBe(30);
  });
  it("formata no padrão brasileiro", () => {
    expect(formatMoney(123456)).toBe("R$ 1.234,56");
    expect(formatMoney(-5000)).toBe("-R$ 50,00");
    expect(centsToInput(15090)).toBe("150,90");
  });
});

describe("datas e atraso", () => {
  it("usa o fuso de Brasília: 23h de 10/09 em Brasília já é 11/09 em UTC", () => {
    expect(today(new Date("2026-09-11T02:00:00Z"))).toBe("2026-09-10");
  });
  it("mensalidade que vence hoje ainda não está atrasada; ontem, sim", () => {
    expect(displayFeeStatus("pending", "2026-09-10", "2026-09-10")).toBe("pending");
    expect(displayFeeStatus("pending", "2026-09-09", "2026-09-10")).toBe("overdue");
    expect(displayFeeStatus("paid", "2026-01-01", "2026-09-10")).toBe("paid");
  });
  it("dia 31 em fevereiro vira o último dia do mês", () => {
    expect(dueDateFor("2026-02", 31)).toBe("2026-02-28");
    expect(dueDateFor("2028-02", 31)).toBe("2028-02-29");
  });
  it("recusa datas impossíveis", () => expect(isValidDate("2026-02-30")).toBe(false));
  it("sugere o próximo vencimento, nunca um já passado", () => {
    expect(nextDueDate(10, "2026-09-24")).toEqual({ reference: "2026-10", dueDate: "2026-10-10" });
    expect(nextDueDate(30, "2026-09-24")).toEqual({ reference: "2026-09", dueDate: "2026-09-30" });
    expect(nextDueDate(24, "2026-09-24")).toEqual({ reference: "2026-09", dueDate: "2026-09-24" });
    expect(nextDueDate(5, "2026-12-20")).toEqual({ reference: "2027-01", dueDate: "2027-01-05" });
  });
});

describe("validações dos formulários", () => {
  it("aluno: mensagens em português", () => {
    const r = studentInput.safeParse({ name: "", phone: "abc", email: "x@", modality: "", joinedAt: "2026-13-01", status: "ativo", monthlyFee: "0", dueDay: "40" });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message).join(" | ");
    expect(msgs).toContain("Informe o nome completo");
    expect(msgs).toContain("Telefone inválido");
    expect(msgs).toContain("E-mail inválido");
  });
  it("mensalidade: valor e período", () => {
    expect(feeInput.safeParse({ studentId: "00000000-0000-4000-8000-000000000000", amount: "150,00", dueDate: "2026-09-10", reference: "2026-09" }).success).toBe(true);
    expect(feeInput.safeParse({ studentId: "00000000-0000-4000-8000-000000000000", amount: "0", dueDate: "2026-09-10", reference: "2026-13" }).success).toBe(false);
  });
  it("financeiro: não aceita a categoria Mensalidade em lançamento manual", () => {
    expect(entryInput.safeParse({ type: "income", category: "Mensalidade", description: "x", amount: "150", date: "2026-09-10" }).success).toBe(false);
    expect(entryInput.safeParse({ type: "expense", category: "Equipamentos", description: "Luvas", amount: "150", date: "2026-09-10" }).success).toBe(true);
  });
});
