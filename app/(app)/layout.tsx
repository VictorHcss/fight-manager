import { Suspense } from "react";
import { Flash } from "@/components/client";
import { Shell } from "@/components/Shell";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { pendingRequestsCount } from "@/services/enrollment";
import { logout } from "../login/actions";
import { can } from "@/lib/permissions";

// páginas com dados do banco nunca são geradas de forma estática
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAcademyAdmin();
  const requests = can(ctx.permissions, "solicitacoes") ? await pendingRequestsCount(ctx) : 0;
  return (
    <Shell academy={ctx.user.academyName ?? ""} user={ctx.user.name} logout={logout} requests={requests} permissions={ctx.permissions}>
      <Suspense fallback={null}><Flash /></Suspense>
      {children}
    </Shell>
  );
}
