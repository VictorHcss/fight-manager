import { Suspense } from "react";
import { Flash } from "@/components/client";
import { Shell } from "@/components/Shell";
import { requireAcademyAdmin } from "@/lib/auth/guards";
import { pendingRequestsCount } from "@/services/enrollment";
import { logout } from "../login/actions";

// páginas com dados do banco nunca são geradas de forma estática
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAcademyAdmin();
  const requests = await pendingRequestsCount(ctx);
  return (
    <Shell academy={ctx.user.academyName ?? ""} user={ctx.user.name} logout={logout} requests={requests}>
      <Suspense fallback={null}><Flash /></Suspense>
      {children}
    </Shell>
  );
}
