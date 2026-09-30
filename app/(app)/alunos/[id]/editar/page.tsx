import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { centsToInput } from "@/lib/money";
import { isUuid, orNotFound } from "@/lib/page";
import { listModalities } from "@/services/academy";
import { guardiansOf } from "@/services/guardians";
import { getStudent } from "@/services/students";
import { updateStudentAction } from "../../actions";
import { StudentForm } from "../../StudentForm";

export const metadata: Metadata = { title: "Editar aluno" };

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAcademyAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const s = await orNotFound(getStudent(ctx, id));
  const [all, guardians] = await Promise.all([listModalities(ctx), guardiansOf(ctx, id)]);
  // ativas, mais a do próprio aluno (mesmo que tenha sido desativada)
  const modalities = all.filter((m) => m.active || m.id === s.modalityId);
  const primary = guardians.find((g) => g.isPrimary);
  const str = (v: string | null | undefined) => v ?? "";
  return (
    <>
      <PageHeader title={`Editar ${s.name}`} />
      <StudentForm action={updateStudentAction.bind(null, s.id)} cancelHref={`/alunos/${s.id}`} submitLabel="Salvar alterações" modalities={modalities}
        primaryGuardian={primary ? `${primary.name} (${primary.relationship})` : null}
        initial={{
          name: s.name, phone: str(s.phone), email: str(s.email), birthDate: str(s.birthDate), cpf: str(s.cpf), modalityId: str(s.modalityId), joinedAt: str(s.joinedAt),
          status: s.status, monthlyFee: s.monthlyFeeCents === null ? "" : centsToInput(s.monthlyFeeCents), dueDay: String(s.dueDay), notes: str(s.notes),
          zip: str(s.zip), street: str(s.street), number: str(s.number), complement: str(s.complement), district: str(s.district), city: str(s.city), state: str(s.state),
          emergencyName: str(s.emergencyName), emergencyPhone: str(s.emergencyPhone), emergencyRelation: str(s.emergencyRelation),
          imageConsent: s.imageConsent === null ? "" : s.imageConsent ? "sim" : "nao",
        }} />
    </>
  );
}
