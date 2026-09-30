import { requireAcademyAdmin } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import { isUuid } from "@/lib/page";
import { exportStudentData } from "@/services/privacy";

/** Download dos dados do aluno em JSON (portabilidade, LGPD). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAcademyAdmin();
  const { id } = await params;
  if (!isUuid(id)) return new Response("Não encontrado", { status: 404 });
  try {
    const data = await exportStudentData(ctx, id);
    const file = `dados-${data.aluno.nome.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${file}"`, "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof NotFoundError) return new Response("Não encontrado", { status: 404 });
    throw error;
  }
}
