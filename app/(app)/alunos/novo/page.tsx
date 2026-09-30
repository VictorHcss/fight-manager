import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { today } from "@/lib/dates";
import { listModalities } from "@/services/academy";
import { createStudentAction } from "../actions";
import { StudentForm } from "../StudentForm";

export const metadata: Metadata = { title: "Novo aluno" };

export default async function NewStudentPage() {
  const ctx = await requireAcademyAdmin();
  const modalities = await listModalities(ctx, { activeOnly: true });
  return (
    <>
      <PageHeader title="Novo aluno" />
      <StudentForm action={createStudentAction} cancelHref="/alunos" submitLabel="Cadastrar aluno" modalities={modalities}
        initial={{ joinedAt: today(), status: "active", dueDay: "10" }} />
    </>
  );
}
