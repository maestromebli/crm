import type { ConvertReadinessBanner, LeadReadinessRow } from "./lead-readiness-rows";
import type {
  CommercialNextAction,
  CommercialWarning,
} from "./commercial-summary";

/** Відповідь `GET /api/leads/[leadId]/hub-summary` — спільний контракт сервер/клієнт. */
export type LeadHubSummaryApiResponse = {
  leadId: string;
  updatedAt: string;
  hubReadiness: {
    level: "ready" | "soft" | "attention";
    headline: string;
  };
  readinessRows: LeadReadinessRow[];
  convertBanner: ConvertReadinessBanner;
  recommendation: string;
  salesHint: string;
  commercial?: {
    warnings: CommercialWarning[];
    nextActions: CommercialNextAction[];
  };
};
