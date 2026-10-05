import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { nextDueDate, todayIn } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import { isUuid } from "@/lib/page";
import { getStudent } from "@/services/students";
import { createFeeAction } from "../actions";
import { FeeForm } from "../FeeForm";

export const metadata: Metadata = { title: "Nova mensalidade" };

export default async function NewFeePage({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const ctx = await requireAcademyAdmin("mensalidades");
  const { aluno = "" } = await searchParams;
  const chosen = aluno && isUuid(aluno) ? await getStudent(ctx, aluno).catch(() => null) : null;
  const suggestion = nextDueDate(chosen?.dueDay ?? 10, todayIn(ctx.timezone));
  return (
    <>
      <PageHeader title="Nova mensalidade" description="O valor vem do cadastro do aluno e pode ser ajustado." />
      <FeeForm action={createFeeAction} cancelHref={chosen ? `/alunos/${chosen.id}` : "/mensalidades"} submitLabel="Criar mensalidade"
        pickStudent
        student={chosen ? { id: chosen.id, name: chosen.name, modality: chosen.modality, phone: chosen.phone, email: chosen.email, status: chosen.status, overdue: 0, monthlyFeeCents: chosen.monthlyFeeCents } : null}
        initial={{ studentId: chosen?.id ?? "", amount: chosen?.monthlyFeeCents ? centsToInput(chosen.monthlyFeeCents) : "", reference: suggestion.reference, dueDate: suggestion.dueDate, notes: "" }} />
    </>
  );
}
