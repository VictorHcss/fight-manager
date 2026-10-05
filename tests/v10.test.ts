// v0.10: tarefa diária (geração automática e lembretes por e-mail).
import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { academies, feeReminders, fees } from "@/db/schema";
import { memoryMailer, useMailer } from "@/lib/email";
import { addDays, runDailyJobs } from "@/services/automation";
import { createStudent } from "@/services/students";
import { newAcademy, studentData } from "./helpers";

let mail: ReturnType<typeof memoryMailer>;
beforeEach(() => { mail = memoryMailer(); useMailer(mail); });
afterEach(() => useMailer(null));

// 12h de 07/03/2031 em Brasília: data fixa, longe da virada do dia
const NOW = new Date("2031-03-07T15:00:00Z");
const DAY = "2031-03-07";
const to = (email: string) => mail.sent.filter((m) => m.to === email);

describe("tarefa diária", () => {
  it("addDays atravessa meses e anos", () => {
    expect(addDays("2031-02-27", 3)).toBe("2031-03-02");
    expect(addDays("2031-01-01", -1)).toBe("2030-12-31");
  });

  it("gera as mensalidades do mês uma vez e não recria a cancelada", async () => {
    const ctx = await newAcademy("Auto");
    const a = await createStudent(ctx, studentData(ctx, { email: `a${Date.now()}@x.dev` }));
    const b = await createStudent(ctx, studentData(ctx, { name: "Lucas Ferreira", email: `b${Date.now()}@x.dev` }));
    await db.insert(fees).values({ academyId: ctx.academyId, studentId: b.id, reference: "2031-03", dueDate: "2031-03-10", amountCents: 15000, status: "canceled" });
    await runDailyJobs("http://x", NOW);
    await runDailyJobs("http://x", NOW);
    const rows = await db.select().from(fees).where(and(eq(fees.academyId, ctx.academyId), eq(fees.reference, "2031-03")));
    expect(rows.filter((f) => f.studentId === a.id)).toHaveLength(1);
    expect(rows.filter((f) => f.studentId === b.id).map((f) => f.status)).toEqual(["canceled"]);
  });

  it("respeita a academia que desligou a geração automática", async () => {
    const ctx = await newAcademy("Manual");
    await db.update(academies).set({ autoGenerateFees: false }).where(eq(academies.id, ctx.academyId));
    await createStudent(ctx, studentData(ctx));
    await runDailyJobs("http://x", NOW);
    expect(await db.select().from(fees).where(eq(fees.academyId, ctx.academyId))).toHaveLength(0);
  });

  it("manda o lembrete antes do vencimento e o aviso de atraso, cada um uma vez só", async () => {
    const ctx = await newAcademy("Lembrete");
    await db.update(academies).set({ autoGenerateFees: false, reminderDaysBefore: 3, pixKey: "52998224725" }).where(eq(academies.id, ctx.academyId));
    const email = `lembrete${Date.now()}@x.dev`;
    const s = await createStudent(ctx, studentData(ctx, { email }));
    const [soon] = await db.insert(fees).values({ academyId: ctx.academyId, studentId: s.id, reference: "2031-03", dueDate: addDays(DAY, 3), amountCents: 15000 }).returning();
    await db.insert(fees).values({ academyId: ctx.academyId, studentId: s.id, reference: "2031-02", dueDate: addDays(DAY, -1), amountCents: 15000 });

    await runDailyJobs("http://sistema", NOW);
    await runDailyJobs("http://sistema", NOW);
    const sent = to(email);
    expect(sent).toHaveLength(2);
    expect(sent.find((m) => m.subject.includes("vence em 10/03/2031"))!.text).toContain("br.gov.bcb.pix");
    expect(sent.some((m) => m.subject.includes("em atraso"))).toBe(true);
    expect(await db.select().from(feeReminders).where(eq(feeReminders.feeId, soon.id))).toHaveLength(1);
  });

  it("não lembra mensalidade já paga nem aluno sem e-mail", async () => {
    const ctx = await newAcademy("Sem lembrete");
    await db.update(academies).set({ autoGenerateFees: false }).where(eq(academies.id, ctx.academyId));
    const s = await createStudent(ctx, studentData(ctx, { email: null }));
    await db.insert(fees).values({ academyId: ctx.academyId, studentId: s.id, reference: "2031-03", dueDate: addDays(DAY, 3), amountCents: 15000 });
    const before = mail.sent.length;
    await runDailyJobs("http://x", NOW);
    expect(mail.sent.slice(before).filter((m) => m.subject.includes(`Sem lembrete`))).toHaveLength(0);
  });
});
