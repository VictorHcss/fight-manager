// Funções puras (sem banco): dinheiro, datas, fuso por academia, CSV, Pix, chave Pix e permissões.
import { describe, expect, it } from "vitest";
import { csvMoney, toCsv } from "@/lib/csv";
import { dueDateFor, isValidDate, nextDueDate, today } from "@/lib/dates";
import { displayFeeStatus } from "@/lib/fee-status";
import { centsToInput, formatMoney, parseMoney } from "@/lib/money";
import { can, hasFullAccess } from "@/lib/permissions";
import { crc16, pixPayload } from "@/lib/pix";
import { entryInput, feeInput, normalizePixKey, studentInput } from "@/lib/validation";

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

describe("CSV", () => {
  it("usa ponto e vírgula, BOM, aspas quando precisa e valores em reais com vírgula", () => {
    const csv = toCsv(["Nome", "Valor"], [["Silva; Ana", csvMoney(123456)], ['Diz "oi"', csvMoney(-500)], [null, undefined]]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Silva; Ana";1234,56');
    expect(csv).toContain('"Diz ""oi""";-5,00');
    expect(csv.trim().split("\r\n")).toHaveLength(4);
  });
});

describe("Pix copia e cola", () => {
  it("CRC16 confere com o valor de referência do padrão (\"123456789\" = 29B1)", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
  it("monta o código com chave, valor, nome, cidade, identificador e CRC válido", () => {
    const code = pixPayload({ key: "+5533998124410", name: "Academia Punho de Ferro", city: "Governador Valadares", amountCents: 15000, txid: "MENS-2026-10" });
    expect(code.startsWith("000201010211")).toBe(true);
    expect(code).toContain("0014br.gov.bcb.pix0114+5533998124410");
    expect(code).toContain("5406150.00");
    expect(code).toContain("5923ACADEMIA PUNHO DE FERRO");
    expect(code).toContain("6015GOVERNADOR VALA");
    expect(code).toContain("62140510MENS202610");
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
  });
});

describe("chave Pix", () => {
  it("normaliza CPF, CNPJ, celular, e-mail e chave aleatória", () => {
    expect(normalizePixKey("529.982.247-25")).toBe("52998224725");
    expect(normalizePixKey("11.222.333/0001-81")).toBe("11222333000181");
    expect(normalizePixKey("(33) 99812-4410")).toBe("+5533998124410");
    expect(normalizePixKey("+55 33 99812-4410")).toBe("+5533998124410");
    expect(normalizePixKey("Financeiro@Academia.com")).toBe("financeiro@academia.com");
    expect(normalizePixKey("123E4567-E89B-12D3-A456-426614174000")).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(normalizePixKey("qualquer coisa")).toBe("");
  });
});

describe("permissões", () => {
  it("null é acesso total; lista libera só o que tem", () => {
    expect(hasFullAccess(null)).toBe(true);
    expect(can(null, "financeiro")).toBe(true);
    expect(can(["alunos", "pagamentos"], "financeiro")).toBe(false);
    expect(can(["alunos", "pagamentos"], "pagamentos")).toBe(true);
  });
});

describe("fuso por academia", () => {
  it("23h30 em Brasília ainda é o mesmo dia no Acre, e 1h da manhã do dia seguinte em Noronha", () => {
    const at = new Date("2026-10-10T02:30:00Z"); // 23h30 de 09/10 em Brasília
    expect(today(at, "America/Sao_Paulo")).toBe("2026-10-09");
    expect(today(at, "America/Rio_Branco")).toBe("2026-10-09");
    expect(today(at, "America/Noronha")).toBe("2026-10-10");
  });
});
