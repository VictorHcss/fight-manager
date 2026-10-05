import { timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/url";
import { runDailyJobs } from "@/services/automation";

export const dynamic = "force-dynamic";

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Tarefa diária (geração automática e lembretes). Chamada pelo serviço "scheduler" do Docker Compose,
 * por um cron do servidor ou por um agendador da hospedagem, com o cabeçalho Authorization: Bearer CRON_SECRET.
 * Sem CRON_SECRET configurado, a rota fica desligada.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || secret.length < 16 || !same(given, secret)) return new Response("Não autorizado", { status: 401 });
  // APP_URL: endereço público do sistema, para os links dos e-mails (o agendador chama pelo endereço interno)
  const result = await runDailyJobs(process.env.APP_URL || (await siteUrl()));
  console.log(JSON.stringify({ level: "info", at: new Date().toISOString(), job: "daily", ...result }));
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
