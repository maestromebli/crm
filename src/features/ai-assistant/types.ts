import type { ComponentType } from "react";
import type { EffectiveRole } from "../../lib/authz/roles";

export type AssistantVisualState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "success"
  | "warning"
  | "error"
  | "sleeping";

export type AssistantRole =
  | "ADMIN"
  | "DIRECTOR"
  | "TEAM_LEAD"
  | "HEAD_MANAGER"
  | "SALES_MANAGER"
  | "MEASURER"
  | "UNKNOWN";

export type AssistantContextKind =
  | "dashboard"
  | "lead"
  | "deal"
  | "calculation"
  | "quote"
  | "contract"
  | "calendar"
  | "unknown";

export type AssistantQuickAction = {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  actionType: "navigate" | "callback" | "modal" | "noop";
  href?: string;
  disabled?: boolean;
};

export type AssistantRecommendation = {
  id: string;
  title: string;
  description?: string;
  level: "info" | "success" | "warning" | "error";
};

export type AssistantResolvedContext = {
  role: AssistantRole;
  contextKind: AssistantContextKind;
  route: string;
  entityId?: string | null;
  entityTitle?: string | null;
  status?: string | null;
  missingFields: string[];
  overdueTasks: number;
  staleSinceHours?: number | null;
  paymentStatus?: string | null;
  quoteStatus?: string | null;
  recommendationCount: number;
  recommendations: AssistantRecommendation[];
  quickActions: AssistantQuickAction[];
  nextBestAction?: string | null;
};

export type AssistantAppearanceConfig = {
  skinTone: string;
  skinToneShadow: string;
  stubbleOpacity: number;
  smileIntensity: number;
  eyeSize: number;
  glowFrom: string;
  glowTo: string;
  ringColor: string;
  panelWidth: string;
  motionIntensity: "low" | "medium";
};

export type AssistantAvatarSize = "sm" | "md" | "lg" | number;

export type AssistantAvatarProps = {
  state: AssistantVisualState;
  size?: AssistantAvatarSize;
  appearance?: Partial<AssistantAppearanceConfig>;
  reducedMotion?: boolean;
  /** Легкий рух «голосу» під час відповіді AI */
  voiceActive?: boolean;
  className?: string;
};

/** Внутрішня класифікація маршруту (детальніше за contextKind) */
export type AssistantRouteKind =
  | "dashboard"
  | "leads_list"
  | "lead_detail"
  | "deals_list"
  | "deal_detail"
  | "deal_workspace"
  | "calendar"
  | "tasks"
  | "production"
  | "handoff"
  | "files"
  | "finance"
  | "reports"
  | "target"
  | "settings"
  | "other";

export type ResolvedPageContext = {
  kind: AssistantRouteKind;
  pathname: string;
  leadId: string | null;
  dealId: string | null;
};

/** Підказки з евристик (без API) — використовуються для резолвера */
export type ContextHint = {
  title: string;
  summary: string;
  suggestedNextStep: string;
  hasSuggestion: boolean;
  tone: "neutral" | "attention" | "risk";
};

export type AssistantSessionSlice = {
  role: EffectiveRole;
  userName: string | null;
  email: string | null;
};
