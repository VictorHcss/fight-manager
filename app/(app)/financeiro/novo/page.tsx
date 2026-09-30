import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { today } from "@/lib/dates";
import { EntryForm } from "../EntryForm";

export const metadata: Metadata = { title: "Novo lançamento" };

export default async function NewEntryPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requireAcademyAdmin();
  const { tipo } = await searchParams;
  return (
    <>
      <PageHeader title="Novo lançamento" description="Despesas, matrículas avulsas e outros recebimentos." />
      <EntryForm today={today()} type={tipo === "income" ? "income" : "expense"} />
    </>
  );
}
