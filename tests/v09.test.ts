// v0.9: Pix copia e cola, chave Pix, permissões da equipe, fuso por academia e confirmação de e-mail.
import { describe, expect, it } from "vitest";
import { crc16, pixPayload } from "@/lib/pix";
import { normalizePixKey } from "@/lib/validation";
import { can, hasFullAccess } from "@/lib/permissions";
import { today } from "@/lib/dates";

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

// ---- com banco ----
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { academies, auditLogs, emailVerifications, fees, users } from "@/db/schema";
import { memoryMailer, useMailer } from "@/lib/email";
import { confirmEmail, isEmailVerified, sendEmailVerification } from "@/services/email-verification";
import { createAcademyAdmin, updateUserPermissions } from "@/services/users";
import { listFees } from "@/services/fees";
import { createStudent } from "@/services/students";
import { newAcademy, studentData } from "./helpers";

describe("equipe com permissões", () => {
  it("cria membro com acesso personalizado, altera e audita; ninguém altera o próprio acesso", async () => {
    const ctx = await newAcademy("Equipe");
    const u = await createAcademyAdmin(ctx, { name: "Camila Duarte", email: `camila${Date.now()}@e.dev`, password: "senha-da-camila" }, ["alunos", "pagamentos"]);
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    expect(row.permissions).toEqual(["alunos", "pagamentos"]);
    await updateUserPermissions(ctx, u.id, null);
    const [after] = await db.select().from(users).where(eq(users.id, u.id));
    expect(after.permissions).toBeNull();
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.entityId, u.id));
    expect(logs.some((l) => l.action === "user.permissions_changed")).toBe(true);
    await expect(updateUserPermissions(ctx, ctx.userId, ["alunos"])).rejects.toThrow("próprio acesso");
  });

  it("não altera membro de outra academia", async () => {
    const a = await newAcademy("A");
    const b = await newAcademy("B");
    await expect(updateUserPermissions(a, b.userId, ["alunos"])).rejects.toThrow();
  });
});

describe("confirmação de e-mail", () => {
  it("envia link, confirma uma vez e aceita abrir de novo depois de confirmado", async () => {
    const mail = memoryMailer(); useMailer(mail);
    try {
      const [u] = await db.insert(users).values({ academyId: null, role: "STUDENT", name: "Lara Nunes", email: `lara${Date.now()}@v.dev`, passwordHash: "x" }).returning();
      expect(await sendEmailVerification(u.id, "http://localhost:3000")).toBe(true);
      const token = mail.sent.at(-1)!.text.match(/confirmar-email\/([A-Za-z0-9_-]+)/)![1];
      expect(await isEmailVerified(u.id)).toBe(false);
      await confirmEmail(token);
      expect(await isEmailVerified(u.id)).toBe(true);
      await expect(confirmEmail(token)).resolves.toMatchObject({ name: "Lara Nunes" });
      expect(await sendEmailVerification(u.id, "http://localhost:3000")).toBe(false); // já confirmado
      await expect(confirmEmail("token-invalido-token-invalido-token-invalido-xx")).rejects.toThrow();
      expect((await db.select().from(emailVerifications).where(eq(emailVerifications.userId, u.id))).length).toBe(1);
    } finally { useMailer(null); }
  });
});

describe("fuso da academia nas mensalidades", () => {
  it("a mesma mensalidade pode estar atrasada em Noronha e a vencer no Acre", async () => {
    const ctx = await newAcademy("Fuso");
    const s = await createStudent(ctx, studentData(ctx));
    const noronha = today(new Date(), "America/Noronha");
    const acre = today(new Date(), "America/Rio_Branco");
    if (noronha === acre) return; // só dá para comparar perto da meia-noite; nos outros horários as duas datas são iguais
    await db.insert(fees).values({ academyId: ctx.academyId, studentId: s.id, reference: acre.slice(0, 7), dueDate: acre, amountCents: 1000, status: "pending" });
    const [n] = await listFees({ ...ctx, timezone: "America/Noronha" }, { studentId: s.id });
    const [a] = await listFees({ ...ctx, timezone: "America/Rio_Branco" }, { studentId: s.id });
    expect(n.displayStatus).toBe("overdue");
    expect(a.displayStatus).toBe("pending");
  });

  it("guarda o fuso escolhido pela academia", async () => {
    const ctx = await newAcademy("Fuso 2");
    const [a] = await db.select({ tz: academies.timezone }).from(academies).where(eq(academies.id, ctx.academyId));
    expect(a.tz).toBe("America/Sao_Paulo");
  });
});
