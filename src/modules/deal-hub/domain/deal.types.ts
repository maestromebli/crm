import type { DealHubHealthStatus, DealHubPriority, DealHubStage } from "./deal.status";

export type DealHubRole =
  | "OWNER"
  | "SALES_MANAGER"
  | "CONSTRUCTOR"
  | "PRODUCTION_MANAGER"
  | "PROCUREMENT_MANAGER"
  | "FINANCE"
  | "INSTALLATION_COORDINATOR"
  | "MANAGER";

export type DealHubStageGateResult = {
  stage: DealHubStage;
  passed: boolean;
  missing: string[];
};

export type DealHubNextAction = {
  id: string;
  title: string;
  description?: string;
  ownerRole: DealHubRole;
  status: "required" | "blocked" | "overdue" | "suggested";
  dueAt?: string | null;
  blockReason?: string;
  command?: string;
};

export type DealHubRiskItem = {
  id: string;
  severity: "warning" | "risk" | "critical";
  title: string;
  description?: string;
};

export type DealHubOverview = {
  deal: {
    id: string;
    title: string;
    code: string;
    status: string;
    stage: DealHubStage;
    stageLabel: string;
    priority: DealHubPriority;
    expectedCloseDate: string | null;
    installationDate: string | null;
    ownerName: string | null;
  };
  client: {
    id: string;
    name: string;
    primaryContactName: string | null;
  } | null;
  pricing: {
    approvedTotal: number | null;
    latestTotal: number | null;
    marginPct: number | null;
    estimatesCount: number;
    latestVersionLabel: string | null;
    lowMarginWarning: boolean;
  };
  finance: {
    paidAmount: number;
    outstandingAmount: number | null;
    depositRequired: number | null;
    depositReceived: number | null;
    finalPaymentRequired: number | null;
    finalPaymentReceived: number | null;
    paymentProgressPct: number | null;
  };
  production: {
    readiness: "ready" | "not_ready" | "blocked";
    hasProductionFlow: boolean;
    handoffStatus: string | null;
    blockersCount: number;
  };
  installation: {
    plannedDate: string | null;
    readiness: "ready" | "not_ready" | "at_risk";
  };
  files: {
    total: number;
    latest: Array<{
      id: string;
      fileName: string;
      category: string;
      createdAt: string;
    }>;
  };
  timelinePreview: Array<{
    id: string;
    type: string;
    title: string;
    occurredAt: string;
    actorName: string | null;
  }>;
  stageGates: DealHubStageGateResult[];
  nextActions: DealHubNextAction[];
  risks: DealHubRiskItem[];
  health: {
    status: DealHubHealthStatus;
    score: number;
    reasons: string[];
    suggestedActions: string[];
  };
};
