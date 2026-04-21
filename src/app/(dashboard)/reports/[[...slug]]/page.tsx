import type { Metadata } from "next";
import { AiV2InsightCard } from "@/features/ai-v2";
import { ReportsHubClient } from "@/features/reports/ReportsHubClient";
import { buildModulePath, pageTitleFromPath } from "@/lib/navigation-resolve";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pathname = buildModulePath("/reports", slug);
  return { title: pageTitleFromPath(pathname, "ENVER CRM") };
}

export default async function ReportsCatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const active = slug?.[0] ?? "sales";
  return (
    <div className="space-y-3">
      <AiV2InsightCard context="dashboard" />
      <ReportsHubClient activeSection={active} />
    </div>
  );
}
