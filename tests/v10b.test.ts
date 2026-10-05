// v0.10: presença e área do responsável.
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { users } from "@/db/schema";
import { memoryMailer, useMailer } from "@/lib/email";
import { today } from "@/lib/dates";
import { attendanceDay, frequencyOf, missingStudents, setPresence } from "@/services/attendance";
import { addDays } from "@/services/automation";
import { dependentsOf, grantGuardianAccess, revokeGuardianAccess } from "@/services/guardian-access";
import { studentOverview } from "@/services/student-portal";
import { createStudent } from "@/services/students";
import { newAcademy, studentData } from "./helpers";

let mail: ReturnType<typeof memoryMailer>;
beforeEach(() => { mail = memoryMailer(); useMailer(mail); });
afterEach(() => useMailer(null));

describe("presença", () => {
  it("marca uma vez por dia, desmarca e conta a frequência", async () => {
    const ctx = await newAcademy("Presença");
    const s = await createStudent(ctx, studentData(ctx));
    const day = today();
    await setPresence(ctx, s.id, day, true);
    await setPresence(ctx, s.id, day, true); // repetido não duplica
    await setPresence(ctx, s.id, addDays(day, -3), true);
    expect((await frequencyOf(ctx.academyId, s.id, day)).last30).toBe(2);
    const [row] = await attendanceDay(ctx, day);
    expect(row).toMatchObject({ present: true, month: 2 });
    await setPresence(ctx, s.id, day, false);
    expect((await frequencyOf(ctx.academyId, s.id, day)).last30).toBe(1);
  });

  it("não marca aluno de outra academia", async () => {
    const a = await newAcademy("A");
    const b = await newAcademy("B");
    const s = await createStudent(b, studentData(b));
    await expect(setPresence(a, s.id, today(), true)).rejects.toThrow();
  });

  it("lista quem sumiu há 14 dias, só depois que a academia começou a usar a presença", async () => {
    const ctx = await newAcademy("Sumidos");
    const s1 = await createStudent(ctx, studentData(ctx));
    const s2 = await createStudent(ctx, studentData(ctx, { name: "Lucas Ferreira" }));
    expect(await missingStudents(ctx)).toEqual([]);
    await setPresence(ctx, s1.id, addDays(today(), -20), true);
    await setPresence(ctx, s2.id, today(), true);
    expect((await missingStudents(ctx)).map((m) => m.id)).toEqual([s1.id]);
  });
});

describe("área do responsável", () => {
  it("cria a conta, envia o link, mostra o dependente e respeita a remoção", async () => {
    const ctx = await newAcademy("Responsável");
    const email = `mae${Date.now()}@r.dev`;
    const s = await createStudent(ctx, studentData(ctx, { name: "Pedro Henrique Souza", birthDate: "2015-03-02", email: null,
      guardianName: "Juliana Souza", guardianPhone: "(33) 99811-2233", guardianEmail: email, guardianRelationship: "mãe" }));
    const { guardianId } = (await (await import("@/services/guardians")).guardiansOf(ctx, s.id)).map((g) => ({ guardianId: g.id }))[0];

    const r = await grantGuardianAccess(ctx, guardianId, "http://x");
    expect(r.created).toBe(true);
    expect(mail.sent.at(-1)!.text).toContain("/redefinir-senha/");
    const [u] = await db.select().from(users).where(eq(users.id, r.userId));
    expect(u.role).toBe("STUDENT");
    expect((await dependentsOf(r.userId)).map((d) => d.id)).toEqual([s.id]);
    const view = await studentOverview({ userId: r.userId, role: "STUDENT" }, s.id);
    expect(view.me.name).toBe("Pedro Henrique Souza");

    await revokeGuardianAccess(ctx, guardianId);
    expect(await dependentsOf(r.userId)).toEqual([]);
    await expect(studentOverview({ userId: r.userId, role: "STUDENT" }, s.id)).rejects.toThrow();
  });

  it("não usa e-mail de conta da equipe", async () => {
    const ctx = await newAcademy("Equipe");
    const [admin] = await db.select().from(users).where(eq(users.id, ctx.userId));
    const s = await createStudent(ctx, studentData(ctx, { birthDate: "2014-01-01", guardianName: "Marcos Lima", guardianPhone: "(33) 99811-0000", guardianEmail: admin.email, guardianRelationship: "pai" }));
    const g = (await (await import("@/services/guardians")).guardiansOf(ctx, s.id))[0];
    await expect(grantGuardianAccess(ctx, g.id, "http://x")).rejects.toThrow("equipe");
  });
});
