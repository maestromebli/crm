import type {
  ExecutiveDashboardQuery,
  FinanceRange,
  SavedViewId,
  TrendMetric,
  TrendRange,
} from "./executive-types";

function first(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = sp[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

export function parseExecutiveDashboardQuery(
  sp: Record<string, string | string[] | undefined>,
): ExecutiveDashboardQuery {
  const financeRaw = first(sp, "financeRange");
  const financeRange: FinanceRange =
    financeRaw === "today" ||
    financeRaw === "week" ||
    financeRaw === "month" ||
    financeRaw === "quarter"
      ? financeRaw
      : "month";

  const trendRaw = first(sp, "trendRange");
  const trendRange: TrendRange =
    trendRaw === "7d" ||
    trendRaw === "30d" ||
    trendRaw === "90d" ||
    trendRaw === "year"
      ? trendRaw
      : "30d";

  const metricRaw = first(sp, "metric");
  const trendMetric: TrendMetric =
    metricRaw === "revenue" ||
    metricRaw === "payments" ||
    metricRaw === "gross_profit" ||
    metricRaw === "expenses"
      ? metricRaw
      : "revenue";

  const viewRaw = first(sp, "view");
  const savedView: SavedViewId =
    viewRaw === "director" ||
    viewRaw === "sales" ||
    viewRaw === "finance" ||
    viewRaw === "production" ||
    viewRaw === "issues"
      ? viewRaw
      : "director";

  const managerId = first(sp, "manager")?.trim() || null;
  const source = first(sp, "source")?.trim() || null;
  const dealStatus = first(sp, "dealStatus")?.trim() || null;
  const q = first(sp, "q")?.trim() || "";

  return {
    financeRange,
    trendRange,
    trendMetric,
    savedView,
    managerId,
    source,
    dealStatus,
    q,
  };
}

export function applySavedViewDefaults(
  q: ExecutiveDashboardQuery,
): ExecutiveDashboardQuery {
  switch (q.savedView) {
    case "sales":
      return { ...q, trendMetric: "revenue", financeRange: "week" };
    case "finance":
      return { ...q, trendMetric: "payments", financeRange: "month" };
    case "production":
      return { ...q, financeRange: "week" };
    case "issues":
      return { ...q, financeRange: "week" };
    default:
      return q;
  }
}
