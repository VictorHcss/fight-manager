import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { formatDate, today } from "@/lib/dates";
import { FEE_STATUS_LABEL } from "@/lib/fee-status";
import { centsToInput, formatMoney } from "@/lib/money";
import { isUuid } from "@/lib/page";
import { listFees } from "@/services/fees";
import { getStudent, studentFinancialSummary } from "@/services/students";
import { PaymentForm } from "../PaymentForm";

export const metadata: Metadata = { title: "Registrar pagamento" };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ aluno?: string; mensalidade?: string }> }) {
  const ctx = await requireAcademyAdmin();
  const sp = await searchParams;
  const chosen = sp.aluno && isUuid(sp.aluno) ? await getStudent(ctx, sp.aluno).catch(() => null) : null;
  const studentId = chosen?.id ?? "";
  const summary = chosen ? await studentFinancialSummary(ctx, chosen.id) : null;
  const open = studentId ? (await listFees(ctx, { studentId })).filter((f) => f.status === "pending") : [];
  const fee = open.find((f) => f.id === sp.mensalidade) ?? (sp.mensalidade === undefined ? open[0] : undefined);

  return (
    <>
      <PageHeader title="Registrar pagamento" description="Escolha o aluno, a mensalidade e confirme o valor." />
      <Suspense>
        <PaymentForm
          student={chosen ? { id: chosen.id, name: chosen.name, modality: chosen.modality, phone: chosen.phone, email: chosen.email, status: chosen.status, overdue: summary?.overdueCount ?? 0, monthlyFeeCents: chosen.monthlyFeeCents } : null}
          fees={open.map((f) => ({ id: f.id, balance: centsToInput(f.balanceCents),
            label: `${f.reference}, vence ${formatDate(f.dueDate)} (${FEE_STATUS_LABEL[f.displayStatus].toLowerCase()}): ${formatMoney(f.balanceCents)} em aberto` }))}
          feeId={fee?.id ?? ""}
          amount={fee ? centsToInput(fee.balanceCents) : ""}
          today={today()}
        />
      </Suspense>
    </>
  );
}
