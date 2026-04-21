import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getDealWorkspacePayload } from "../../../../../features/deal-workspace/queries";
import { DealWorkspaceShell } from "../../../../../components/deal-workspace/DealWorkspaceShell";
import { DealWorkspaceDemoPage } from "../../../../../features/deal-workspace/demo/DealWorkspaceDemoPage";
import { getSessionAccess } from "../../../../../lib/authz/session-access";

type Props = {
  params: Promise<{ dealId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { dealId } = await params;
  if (dealId === "demo") {
    return { title: "Демо воркспейс замовлення · ENVER CRM" };
  }
  const access = await getSessionAccess();
  const data = access
    ? await getDealWorkspacePayload(dealId, access.ctx)
    : null;
  if (!data) return { title: "Замовлення · ENVER CRM" };
  return {
    title: `${data.deal.title} · Робоче місце · ENVER CRM`,
  };
}

function WorkspaceFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
      Завантаження…
    </div>
  );
}

export default async function DealWorkspacePage({ params }: Props) {
  const { dealId } = await params;
  if (dealId === "demo") {
    return <DealWorkspaceDemoPage />;
  }
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  const data = await getDealWorkspacePayload(dealId, access.ctx);
  if (!data) notFound();

  return (
    <Suspense fallback={<WorkspaceFallback />}>
      <DealWorkspaceShell
        data={data}
        viewerRole={access.role}
        viewerPermissionKeys={access.permissionKeys}
        viewerRealRole={access.realRole}
        viewerImpersonatorId={access.impersonatorId}
      />
    </Suspense>
  );
}
