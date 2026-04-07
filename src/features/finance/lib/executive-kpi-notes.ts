/** Ідентифікатори метрик верхнього KPI-ряду — узгоджені з `FinanceExecutiveKpi` та API. */
export const FINANCE_EXECUTIVE_KPI_METRIC_IDS = [
  "contractPortfolio",
  "receivedFromClients",
  "receivables",
  "payables",
  "cashOperatingExpenses",
  "procurementPlanned",
  "procurementAccrual",
  "procurementCommitted",
  "procurementReceivedValue",
  "netProfitCash",
] as const;

export type FinanceExecutiveKpiMetricId = (typeof FINANCE_EXECUTIVE_KPI_METRIC_IDS)[number];

export function isFinanceExecutiveKpiMetricId(s: string): s is FinanceExecutiveKpiMetricId {
  return (FINANCE_EXECUTIVE_KPI_METRIC_IDS as readonly string[]).includes(s);
}

/** Нормалізація payload: лише рядки, обрізання ключів/значень. */
export function normalizeKpiPayload(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k).slice(0, 80);
    if (!key) continue;
    if (typeof v === "string") {
      out[key] = v.slice(0, 8000);
    } else if (v != null && (typeof v === "number" || typeof v === "boolean")) {
      out[key] = String(v).slice(0, 8000);
    }
  }
  return out;
}

export type ExecutiveKpiNoteRow = {
  metricId: FinanceExecutiveKpiMetricId;
  payload: Record<string, string>;
  updatedAt: string;
  updatedByName: string | null;
};

export type ExecutiveKpiNotesMap = Partial<Record<FinanceExecutiveKpiMetricId, ExecutiveKpiNoteRow>>;

export function executiveKpiNotesMapFromRows(rows: ExecutiveKpiNoteRow[]): ExecutiveKpiNotesMap {
  const m: ExecutiveKpiNotesMap = {};
  for (const r of rows) {
    m[r.metricId] = r;
  }
  return m;
}

export function countSavedExecutiveKpiNotes(map: ExecutiveKpiNotesMap): number {
  return Object.values(map).filter(Boolean).length;
}
