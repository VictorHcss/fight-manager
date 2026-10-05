import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLogs, guardians, modalities, studentGuardians } from "@/db/schema";
import { isValidCnpj, isValidCpf } from "@/lib/cpf";
import { today } from "@/lib/dates";
import { academyInput, studentInput } from "@/lib/validation";
import { createModality, setModalityActive, setupStatus, updateAcademy, updateTerms } from "@/services/academy";
import { billingContact, guardiansOf, removeGuardian, saveGuardian, setPrimaryGuardian } from "@/services/guardians";
import { generateMonthlyFees } from "@/services/fees";
import { createStudent, getHealth, getStudent, listStudents, updateHealth, updateStudent } from "@/services/students";
import { modalityOf, newAcademy, studentData } from "./helpers";

const year = Number(today().slice(0, 4));
const child = (ctx: Parameters<typeof studentData>[0], extra: Parameters<typeof studentData>[1] = {}) =>
  studentData(ctx, { name: "Pedro Souza", phone: null, email: null, birthDate: `${year - 9}-03-12`, ...extra });
const mother = { guardianName: "Juliana Souza", guardianPhone: "(33) 99877-6655", guardianRelationship: "Mãe" };

describe("documentos e endereço", () => {
  it("confere CPF e CNPJ pelos dígitos", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
  });
  it("formulário: CPF formatado, CEP normalizado, UF e nascimento obrigatório", () => {
    const base = { name: "Ana Lima", modalityId: "00000000-0000-4000-8000-000000000000", joinedAt: "2026-01-01", status: "active", monthlyFee: "150", dueDay: "10" };
    const ok = studentInput.parse({ ...base, birthDate: "1990-01-01", cpf: "52998224725", zip: "35010000", state: "mg" });
    expect([ok.cpf, ok.zip, ok.state]).toEqual(["529.982.247-25", "35010-000", "MG"]);
    const bad = studentInput.safeParse({ ...base, birthDate: "", cpf: "123", zip: "123", state: "XX" });
    expect([...new Set(bad.error?.issues.map((i) => String(i.path[0])))].sort()).toEqual(["birthDate", "cpf", "state", "zip"]);
    expect(academyInput.safeParse({ name: "Academia", document: "11.222.333/0001-80" }).success).toBe(false);
  });
});

describe("modalidades da academia", () => {
  it("cadastro só aceita modalidade ativa da própria academia; inativa continua valendo para quem já tem", async () => {
    const a = await newAcademy();
    const b = await newAcademy();
    await expect(createStudent(a, studentData(a, { modalityId: modalityOf(b) }))).rejects.toThrow("Escolha uma modalidade da academia");
    const muay = await createModality(a, { name: "Muay Thai", defaultFee: 16000 });
    await expect(createModality(a, { name: "muay thai", defaultFee: null })).rejects.toThrow("Já existe");
    const s = await createStudent(a, studentData(a, { modalityId: muay.id }));
    expect((await getStudent(a, s.id)).modality).toBe("Muay Thai");

    await setModalityActive(a, muay.id, false);
    await expect(createStudent(a, studentData(a, { modalityId: muay.id, name: "Outro Aluno" }))).rejects.toThrow("Escolha uma modalidade");
    await updateStudent(a, s.id, studentData(a, { modalityId: muay.id, phone: "(33) 99000-1111" })); // quem já tinha continua
    expect((await generateMonthlyFees(a, "2026-11")).created).toBe(1); // e continua recebendo mensalidade
  });
});

describe("menores de idade e responsáveis", () => {
  it("menor não é salvo sem responsável; com responsável, ele é o principal e o contato de cobrança", async () => {
    const ctx = await newAcademy();
    await expect(createStudent(ctx, child(ctx))).rejects.toThrow("precisa de um responsável");
    await expect(createStudent(ctx, child(ctx, { guardianName: "Juliana Souza", guardianPhone: "(33) 99877-6655" }))).rejects.toThrow("parentesco");
    const pedro = await createStudent(ctx, child(ctx, mother));
    const [g] = await guardiansOf(ctx, pedro.id);
    expect([g.name, g.relationship, g.isPrimary]).toEqual(["Juliana Souza", "Mãe", true]);
    expect(await billingContact(ctx, pedro.id)).toEqual({ name: "Juliana Souza", phone: "(33) 99877-6655", isGuardian: true });
  });

  it("irmãos compartilham o mesmo responsável", async () => {
    const ctx = await newAcademy();
    const pedro = await createStudent(ctx, child(ctx, mother));
    const [juliana] = await guardiansOf(ctx, pedro.id);
    const laura = await createStudent(ctx, child(ctx, { name: "Laura Souza", guardianId: juliana.id, guardianRelationship: "Mãe" }));
    expect((await guardiansOf(ctx, laura.id))[0].id).toBe(juliana.id);
    expect(await db.select().from(guardians).where(eq(guardians.academyId, ctx.academyId))).toHaveLength(1);
  });

  it("não usa responsável de outra academia", async () => {
    const a = await newAcademy();
    const b = await newAcademy();
    const kid = await createStudent(b, child(b, mother));
    const [other] = await guardiansOf(b, kid.id);
    await expect(createStudent(a, child(a, { guardianId: other.id, guardianRelationship: "Mãe" }))).rejects.toThrow("Responsável não encontrado");
  });

  it("menor não fica sem principal; trocar o principal funciona", async () => {
    const ctx = await newAcademy();
    const pedro = await createStudent(ctx, child(ctx, mother));
    const [juliana] = await guardiansOf(ctx, pedro.id);
    await expect(removeGuardian(ctx, pedro.id, juliana.id)).rejects.toThrow("precisa de um responsável principal");
    const marcos = await saveGuardian(ctx, pedro.id, { guardianId: null, name: "Marcos Souza", cpf: null, phone: "(33) 99811-7766", email: null, relationship: "Pai", isPrimary: false, zip: null, street: null, number: null, complement: null, district: null, city: null, state: null });
    expect((await guardiansOf(ctx, pedro.id)).find((g) => g.id === marcos)?.isPrimary).toBe(false);
    await setPrimaryGuardian(ctx, pedro.id, marcos);
    expect((await billingContact(ctx, pedro.id))?.name).toBe("Marcos Souza");
    await removeGuardian(ctx, pedro.id, juliana.id); // agora pode: não é mais a principal
    const links = await db.select().from(studentGuardians).where(eq(studentGuardians.studentId, pedro.id));
    expect(links.map((l) => l.isPrimary)).toEqual([true]);
  });

  it("a criança é encontrada pelo nome ou telefone do responsável", async () => {
    const ctx = await newAcademy();
    await createStudent(ctx, child(ctx, mother));
    expect((await listStudents(ctx, { q: "juliana" })).map((s) => [s.name, s.guardian])).toEqual([["Pedro Souza", "Juliana Souza"]]);
    expect((await listStudents(ctx, { q: "99877" })).map((s) => s.name)).toEqual(["Pedro Souza"]);
  });

  it("adulto não exige responsável e usa o próprio contato", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    expect(await billingContact(ctx, s.id)).toBeNull();
  });
});

describe("saúde (dado sensível)", () => {
  it("fica fora do cadastro comum, exige consentimento e não vai para a auditoria", async () => {
    const ctx = await newAcademy();
    const s = await createStudent(ctx, studentData(ctx));
    await expect(updateHealth(ctx, s.id, "Asma leve", false)).rejects.toThrow("consentimento");
    await updateHealth(ctx, s.id, "Asma leve, usa bombinha", true);
    expect("healthNotes" in (await getStudent(ctx, s.id))).toBe(false);
    expect((await getHealth(ctx, s.id)).notes).toBe("Asma leve, usa bombinha");
    const [log] = await db.select().from(auditLogs).where(and(eq(auditLogs.entityId, s.id), eq(auditLogs.action, "student.health")));
    expect(log.summary).not.toContain("Asma");
    const other = await newAcademy();
    await expect(getHealth(other, s.id)).rejects.toThrow("não encontrado");
  });
});

describe("primeira utilização", () => {
  it("mostra o que falta configurar", async () => {
    const ctx = await newAcademy();
    await db.update(modalities).set({ active: false }).where(eq(modalities.academyId, ctx.academyId));
    expect((await setupStatus(ctx)).steps.map((s) => s.done)).toEqual([false, false, false]);
    await updateAcademy(ctx, academyInput.parse({ name: "Academia Teste", phone: "(33) 3271-0000", city: "Governador Valadares", state: "MG" }));
    await createModality(ctx, { name: "Jiu-Jitsu", defaultFee: null });
    await updateTerms(ctx, "1. Regras da academia.");
    expect((await setupStatus(ctx)).complete).toBe(true);
  });
});
