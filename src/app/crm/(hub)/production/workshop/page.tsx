import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { WorkshopKanbanClient } from "@/features/production/ui/workshop/WorkshopKanbanClient";
import { canViewProduction } from "@/features/production/server/permissions/production-permissions";
import {
  parseWorkshopStageParam,
  WORKSHOP_STAGE_SLUG,
} from "@/features/production/workshop-stages";

export const metadata: Metadata = {
  title: "Цеховий Kanban · ENVER CRM",
};

type Props = { searchParams?: Promise<{ stage?: string }> };

export default async function WorkshopKanbanPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }
  if (
    !canViewProduction({
      dbRole: session.user.role,
      realRole: session.user.realRole ?? session.user.role,
      permissionKeys: session.user.permissionKeys ?? [],
    })
  ) {
    redirect("/access-denied");
  }
  const sp = await searchParams;
  const legacy = parseWorkshopStageParam(sp?.stage ?? null);
  if (legacy) {
    redirect(`/crm/production/workshop/${WORKSHOP_STAGE_SLUG[legacy]}`);
  }
  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <WorkshopKanbanClient />
    </main>
  );
}
