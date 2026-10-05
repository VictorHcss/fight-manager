import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { todayIn } from "@/lib/dates";
import { EntryForm } from "../EntryForm";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const ctx = await requireAcademyAdmin("financeiro");
  const { tipo } = await searchParams;
  return (
    <>
      <PageHeader title="Novo lançamento" description="Despesas, matrículas avulsas e outros recebimentos." />
      <EntryForm today={todayIn(ctx.timezone)} type={tipo === "income" ? "income" : "expense"} />
    </>
  );
}
