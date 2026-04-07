import type { EffectiveRole } from "@/lib/authz/roles";

export type AiV2ContextName =
  | "lead"
  | "deal"
  | "dashboard"
  | "finance"
  | "production"
  | "procurement";

export type AiV2EntityType = "LEAD" | "DEAL" | "DASHBOARD";

export type AiV2EventType =
  | "lead_created"
  | "lead_updated"
  | "manager_assigned"
  | "contact_logged"
  | "measurement_scheduled"
  | "measurement_done"
  | "file_uploaded"
  | "estimate_version_created"
  | "quote_sent"
  | "quote_viewed"
  | "quote_approved"
  | "contract_created"
  | "payment_expected"
  | "payment_received"
  | "payment_overdue"
  | "purchase_needed"
  | "production_ready_check"
  | "constructor_question_opened"
  | "production_approved"
  | "mount_scheduled";

export type AiV2ActorContext = {
  userId: string;
  role: EffectiveRole;
  permissionKeys: string[];
  realRole: string;
  impersonatorId?: string;
};

export type AiV2ContextSnapshot = {
  context: AiV2ContextName;
  entityType: AiV2EntityType;
  entityId: string;
  title: string;
  ownerId?: string;
  flags: {
    overdueTasks: number;
    missingFiles: number;
    missingDataCount: number;
    pendingPayments: number;
    silenceHours: number;
    slaBreached: boolean;
    slaOverdueHours: number;
    openConstructorQuestions: number;
  };
  timelineFacts: string[];
};

export type AiV2Decision = {
  summary: string;
  riskScore: number;
  healthScore: number;
  blockers: string[];
  riskReasons: string[];
  nextBestAction: string;
  followUpUrgency: "low" | "medium" | "high";
  readinessToNextStage: "not_ready" | "attention" | "ready";
};

export type AiV2ActionType =
  | "create_task"
  | "create_reminder"
  | "escalate_team_lead";

export type AiV2ActionPlanItem = {
  type: AiV2ActionType;
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  lowRisk: boolean;
};

export type AiV2MemorySnapshot = {
  keyFacts: string[];
  unresolvedQuestions: string[];
  freshness: "fresh" | "stale";
};
