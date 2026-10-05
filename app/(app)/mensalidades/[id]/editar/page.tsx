import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Alert, PageHeader } from "@/components/ui";
import { safeBack } from "@/lib/action";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { centsToInput } from "@/lib/money";
import { isUuid, orNotFound } from "@/lib/page";
import { getFee } from "@/services/fees";
import { updateFeeAction } from "../../actions";
import { FeeForm } from "../../FeeForm";

export const metadata: Metadata = { title: "Editar mensalidade" };

export default async function EditFeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ back?: string }> }) {
  const ctx = await requireAcademyAdmin("mensalidades");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const back = safeBack((await searchParams).back ?? null, "/mensalidades");
  const f = await orNotFound(getFee(ctx, id));
  return (
    <>
      <PageHeader title={`Mensalidade de ${f.studentName}`} />
      {f.status !== "pending" || f.paidCents > 0 ? (
        <Alert tone="info">Esta mensalidade já recebeu pagamento ou foi encerrada, por isso não pode ser editada. Para corrigir, cancele o pagamento correspondente.</Alert>
      ) : (
        <FeeForm action={updateFeeAction.bind(null, f.id)} cancelHref={back} back={back} submitLabel="Salvar alterações"
          initial={{ studentId: f.studentId, amount: centsToInput(f.amountCents), dueDate: f.dueDate, reference: f.reference, notes: f.notes ?? "" }} />
      )}
    </>
  );
}
