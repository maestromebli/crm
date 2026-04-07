import type { Metadata } from "next";
import { WarehouseHubClient } from "@/features/warehouse/WarehouseHubClient";
import { AiV2InsightCard } from "@/features/ai-v2";
import { buildModulePath, pageTitleFromPath } from "@/lib/navigation-resolve";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/warehouse", slug);
  return { title: pageTitleFromPath(pathname, "ENVER CRM") };
}

export default async function WarehouseCatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const active = slug?.[0] ?? "overview";
  return (
    <div className="space-y-3">
      <AiV2InsightCard context="dashboard" />
      <WarehouseHubClient activeSection={active} />
    </div>
  );
}
