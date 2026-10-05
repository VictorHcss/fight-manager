import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/** Para monitor de disponibilidade (UptimeRobot, Better Stack, healthcheck do Docker): confere o banco. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
