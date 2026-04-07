/**
 * Контракти з пакету add-on (cursor_addon_ai_rules_automation.md).
 * Реалізація — евристики без зовнішнього LLM; OpenAI можна підключити окремо.
 */

export type NextBestActionPriority = "HIGH" | "MEDIUM" | "LOW";

export type NextBestActionTarget =
  | "contact"
  | "communication"
  | "estimate"
  | "proposal"
  | "convert";

export type NextBestActionResult = {
  title: string;
  reason: string;
  priority: NextBestActionPriority;
  ctaLabel?: string;
  target?: NextBestActionTarget;
};

export type MissingInfoSeverity = "HIGH" | "MEDIUM" | "LOW";

export type MissingInfoItem = {
  key: string;
  label: string;
  severity: MissingInfoSeverity;
  reason: string;
  suggestion?: string;
};

export type MissingInfoResult = MissingInfoItem[];

export type ParsedEstimateDraft = {
  summary: string;
  inferredProjectType?: string;
  suggestedItems: Array<{
    category: string;
    title: string;
    description?: string;
    qty: number;
    unit?: string;
    suggestedUnitPrice?: number | null;
    supplierHints?: Array<{
      provider: "VIYAR" | "OTHER";
      materialQuery: string;
    }>;
  }>;
  missingSuggestions: string[];
  warnings: string[];
};

export type ConversionTransferSuggestion = {
  recommendedFileIds: string[];
  excludedFileIds: string[];
  recommendedEstimateId?: string;
  recommendedProposalId?: string;
  includeCommunication: boolean;
  reasonSummary: string;
};

export type SupplierMatchResult = {
  matches: Array<{
    provider: "VIYAR" | "OTHER";
    externalId: string;
    name: string;
    category?: string;
    unit?: string;
    pricePerUnit?: number | null;
    sourceUrl?: string;
    confidence: number;
  }>;
  queryNormalized: string;
};

export type DealAiWarningItem = {
  title: string;
  content: string;
  severity?: "critical" | "warning" | "info" | string;
};

export type DealStageAiId =
  | "qualification"
  | "measurement"
  | "proposal"
  | "contract"
  | "payment"
  | "handoff"
  | "production";

export type DealStageInsight = {
  stage: DealStageAiId;
  summary: string;
  confidence: number;
  nextAction: string;
  risks: string[];
  recommendedUpdates: string[];
};
