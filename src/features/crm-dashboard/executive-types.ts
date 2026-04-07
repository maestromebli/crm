import type { ExecutiveLayoutMode } from "../../lib/authz/roles";

export type FinanceRange = "today" | "week" | "month" | "quarter";
export type TrendRange = "7d" | "30d" | "90d" | "year";
export type TrendMetric = "revenue" | "payments" | "gross_profit" | "expenses";
export type SavedViewId =
  | "director"
  | "sales"
  | "finance"
  | "production"
  | "issues";

export type ExecutiveDashboardQuery = {
  financeRange: FinanceRange;
  trendRange: TrendRange;
  trendMetric: TrendMetric;
  savedView: SavedViewId;
  /** Обмежити угоди/ліди менеджером (user id). */
  managerId: string | null;
  /** Фільтр джерела ліда. */
  source: string | null;
  /** Фільтр статусу угоди (OPEN | …) — опційно. */
  dealStatus: string | null;
  q: string;
};

export type KpiDelta = {
  absolute: number;
  percent: number | null;
  label: string;
};

export type KpiEntry = {
  id: string;
  title: string;
  hint: string;
  value: string;
  valueNumeric: number;
  delta: KpiDelta | null;
  format: "currency" | "count" | "percent";
};

export type FunnelStageRow = {
  stageId: string;
  name: string;
  slug: string;
  count: number;
  amount: number;
  conversionPct: number | null;
  dropoffPct: number | null;
};

export type TrendPoint = {
  label: string;
  date: string;
  revenue: number;
  payments: number;
  grossProfit: number;
  expenses: number;
};

export type CashflowPreview = {
  received: number;
  outgoing: number;
  balance: number;
  forecast7d: number;
  currency: string;
};

export type NextActionItem = {
  id: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  ctaLabel: string;
  href: string;
  entityType: "deal" | "lead" | "task" | "invoice" | "production" | "procurement";
};

export type RiskType =
  | "payment"
  | "deadline"
  | "margin"
  | "supplier_delay"
  | "production_delay";

export type RiskRow = {
  id: string;
  entityType: "deal" | "production" | "procurement";
  entityId: string;
  name: string;
  riskType: RiskType;
  score: number;
  reason: string;
  href: string;
};

export type TeamMemberStat = {
  userId: string;
  name: string;
  dealsOpen: number;
  tasksOpen: number;
  conversions30d: number;
};

export type TeamPerformanceBlock = {
  leaderboard: TeamMemberStat[];
  dealsInWork: number;
  avgConversionPct: number | null;
  responseSpeedHours: number | null;
  tasksOverdue: number;
};

export type FinanceOverview = {
  paymentsToday: number;
  paymentsOverdue: number;
  expensesMonth: number;
  topUnpaidInvoices: Array<{
    id: string;
    dealId: string;
    dealTitle: string;
    amount: number;
    status: string;
    daysOverdue: number;
  }>;
  marginByDeal: Array<{
    dealId: string;
    title: string;
    revenue: number;
    marginPct: number | null;
  }>;
};

export type ProductionOverview = {
  queued: number;
  inProgress: number;
  delayed: number;
  readyForDelivery: number;
  workerLoadPct: number;
  progressRingPct: number;
  topDelayed: Array<{
    id: string;
    dealTitle: string;
    deadline: string | null;
    daysLate: number;
  }>;
  urgentIssues: Array<{ id: string; title: string; orderId: string }>;
};

export type ProcurementOverview = {
  pendingOrders: number;
  supplierDelays: number;
  lowStockMaterials: number;
  deliveriesThisWeek: number;
};

export type ScheduleItem = {
  id: string;
  time: string;
  title: string;
  type: string;
  context: string;
  href: string | null;
  isOverdueTask?: boolean;
};

export type SchedulePreview = {
  today: ScheduleItem[];
  nextEvent: ScheduleItem | null;
  overdueTasks: number;
};

export type DirectorAiBlock = {
  summaryLines: string[];
  problems: Array<{ label: string; detail: string }>;
  recommendations: Array<{
    action: string;
    ownerHint: string;
    priority: "high" | "medium" | "low";
  }>;
  forecast: {
    revenue: string;
    risks: string;
    bottlenecks: string;
  };
};

export type BehaviorScoreBreakdown = {
  userId: string;
  name: string;
  firstContactDiscipline: number;
  followUpDiscipline: number;
  leadVelocity: number;
  dealMovement: number;
  managerResponsiveness: number;
  conversionHygiene: number;
  managerBehaviorScore: number;
  signals: string[];
};

export type BehaviorEngineSnapshot = {
  teamBehaviorScore: number;
  managerScores: BehaviorScoreBreakdown[];
  weakManagers: Array<{
    userId: string;
    name: string;
    score: number;
    primaryIssue: string;
  }>;
  alerts: Array<{
    id: string;
    severity: "high" | "medium";
    label: string;
    detail: string;
    href: string;
  }>;
};

export type DailyOperatingSnapshot = {
  priorities: NextActionItem[];
  workload: {
    overdueTasks: number;
    meetingsToday: number;
    staleLeads: number;
    delayedProduction: number;
  };
  weakManagers: Array<{
    userId: string;
    name: string;
    score: number;
  }>;
};

export type ExecutiveDashboardPayload = {
  layout: ExecutiveLayoutMode;
  query: ExecutiveDashboardQuery;
  kpis: KpiEntry[];
  funnel: FunnelStageRow[];
  trend: TrendPoint[];
  cashflow: CashflowPreview | null;
  nextActions: NextActionItem[];
  risks: RiskRow[];
  team: TeamPerformanceBlock | null;
  finance: FinanceOverview | null;
  production: ProductionOverview | null;
  procurement: ProcurementOverview | null;
  schedule: SchedulePreview | null;
  directorAi: DirectorAiBlock;
  behavior: BehaviorEngineSnapshot;
  daily: DailyOperatingSnapshot;
  /** Знімок для зворотної сумісності / уваги. */
  legacyAttentionCount: number;
  error?: string;
};
