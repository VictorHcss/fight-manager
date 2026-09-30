import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { currentReference } from "@/lib/dates";
import { GenerateForm } from "./GenerateForm";

export const metadata: Metadata = { title: "Gerar mensalidades" };

export default async function GeneratePage() {
  await requireAcademyAdmin();
  return (
    <>
      <PageHeader title="Gerar mensalidades do mês" />
      <Card>
        <p style={{ marginTop: 0 }}>Cria uma mensalidade para cada aluno <strong>ativo</strong>, com o valor mensal e o dia de vencimento do cadastro dele.</p>
        <ul className="muted small">
          <li>Alunos que já têm mensalidade nesse mês são pulados: rodar de novo não duplica nada.</li>
          <li>Nada é gerado sozinho: a geração só acontece quando você clica no botão.</li>
          <li>Depois de gerar, dá para editar ou cancelar cada mensalidade antes de registrar o pagamento.</li>
          <li>Se você gerar o mês atual depois do dia de vencimento de algum aluno, a mensalidade dele já aparece como atrasada.</li>
        </ul>
        <GenerateForm reference={currentReference()} />
      </Card>
    </>
  );
}
