/** Tarefa diária pelo terminal (cron do servidor): npm run jobs:daily */
import "./load-env";
import { runDailyJobs } from "../services/automation";

const base = process.env.APP_URL || "http://localhost:3000";
runDailyJobs(base)
  .then((r) => { console.log(`Academias: ${r.academies}. Mensalidades geradas: ${r.generated}. Lembretes enviados: ${r.reminders}.`); process.exit(0); })
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
