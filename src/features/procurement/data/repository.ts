import type { ProcurementProjectPageData } from "./live-procurement-project";
import type { ProcurementOverviewBundle } from "../types/overview-bundle";

export type { ProcurementOverviewBundle } from "../types/overview-bundle";
export type { ProcurementProjectPageData } from "./live-procurement-project";

export async function getProcurementOverviewData(): Promise<ProcurementOverviewBundle> {
  const { tryLoadLiveProcurementOverview } = await import("./live-procurement-overview");
  const live = await tryLoadLiveProcurementOverview();
  if (!live) {
    throw new Error("Live procurement overview is unavailable.");
  }
  return live;
}

export async function getProcurementProjectData(projectId: string): Promise<ProcurementProjectPageData | null> {
  const { tryLoadProcurementProjectFromDeal } = await import("./live-procurement-project");
  return tryLoadProcurementProjectFromDeal(projectId);
}
