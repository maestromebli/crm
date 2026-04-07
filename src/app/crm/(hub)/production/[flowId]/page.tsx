import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth/options";
import { getProductionOrderHub } from "@/features/production/server/queries/get-production-order-hub";
import { ProductionOrderHubPage } from "@/features/production/ui/order-hub/ProductionOrderHubPage";
import { AiV2InsightCard } from "@/features/ai-v2";

export const metadata: Metadata = {
  title: "Потік виробництва · ENVER CRM",
};

export default async function ProductionFlowPage(props: { params: Promise<{ flowId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const { flowId } = await props.params;
  const data = await getProductionOrderHub({ session, flowId });
  if (!data) {
    notFound();
  }
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <AiV2InsightCard context="production" />
      <ProductionOrderHubPage data={data} />
    </main>
  );
}
