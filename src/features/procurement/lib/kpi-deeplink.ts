/**
 * Deep links з `ProcurementKpiCards`: `?kpi=` → секція сторінки та пресети фільтрів.
 */

/** id секцій у `ProcurementOverviewTables` / `SectionCard`. */
export const PROCUREMENT_KPI_SCROLL_SECTION: Record<string, string> = {
  planned: "proc-section-items",
  actual: "proc-section-items",
  overrun: "proc-section-items",
  ordered: "proc-section-orders",
  committed: "proc-section-orders",
  received: "proc-section-receipts",
  paid: "proc-section-orders",
  awaiting: "proc-section-orders",
  gap: "proc-section-orders",
};

export type ProcurementKpiFilterPreset = {
  itemStatus?: string;
  requestStatus?: string;
};

/** Пресети під KPI-картки (емністично під довідники статусів). */
export const PROCUREMENT_KPI_FILTER_PRESET: Record<string, ProcurementKpiFilterPreset> = {
  planned: { itemStatus: "APPROVED" },
  actual: { itemStatus: "PARTIALLY_RECEIVED" },
  ordered: { itemStatus: "ORDERED" },
  committed: { requestStatus: "ORDERED" },
  received: { itemStatus: "RECEIVED" },
  paid: {},
  awaiting: { itemStatus: "ORDERED" },
  gap: { itemStatus: "ORDERED" },
  overrun: { itemStatus: "APPROVED" },
};

export function procurementKpiScrollTargetId(kpi: string | null): string | null {
  if (!kpi) return null;
  return PROCUREMENT_KPI_SCROLL_SECTION[kpi] ?? null;
}

export function procurementKpiFilterPreset(kpi: string | null): ProcurementKpiFilterPreset | null {
  if (!kpi) return null;
  if (!Object.prototype.hasOwnProperty.call(PROCUREMENT_KPI_FILTER_PRESET, kpi)) return null;
  return PROCUREMENT_KPI_FILTER_PRESET[kpi];
}
