import type { LeadDetailRow } from "../../features/leads/queries";
import {
  deriveLeadMissingInfo,
  deriveLeadNextBestAction,
  deriveOperationalLeadSummaryLines,
  deriveStaleLeadSummary,
} from "../ai-workflow";
import type { MissingInfoResult, NextBestActionResult } from "../ai-workflow/types";
import type { ConvertReadinessBanner, LeadReadinessRow } from "./lead-readiness-rows";
import type { CommercialNextAction, CommercialWarning } from "./commercial-summary";

export type LeadHubWorkflowPayload = {
  nextBestAction: NextBestActionResult | null;
  staleLeadSummary: string | null;
  missingInfo: MissingInfoResult;
  operationalSummaryLines: string[];
};

/**
 * Контракт `GET /api/leads/:id/hub` (addon: lead hub aggregator).
 * Узгоджено з поточними моделями ENVER (Lead pipeline, LeadProposal, Estimate).
 */
export type LeadHubApiResponse = {
  leadId: string;
  updatedAt: string;
  lead: {
    title: string;
    source: string;
    stageName: string;
    ownerName: string | null;
    ownerEmail: string;
  };
  readinessRows: LeadReadinessRow[];
  convertBanner: ConvertReadinessBanner;
  recommendation: string;
  salesHint: string;
  commercial: {
    warnings: CommercialWarning[];
    nextActions: CommercialNextAction[];
  };
  estimates: Array<{
    id: string;
    version: number;
    status: string;
    totalPrice: number | null;
    updatedAt: string;
  }>;
  proposals: Array<{
    id: string;
    version: number;
    status: string;
    estimateId: string | null;
    hasSnapshot: boolean;
    createdAt: string;
  }>;
  contactsSummary: {
    primaryName: string | null;
    phone: string | null;
    extraContacts: number;
  };
  /** Операційний шар AI / правил (без зовнішнього LLM). */
  workflow: LeadHubWorkflowPayload;
  aiInsights: Array<{ id: string; title: string; content: string }>;
};

export function buildLeadHubApiResponse(
  lead: LeadDetailRow,
  opts: {
    readinessRows: LeadReadinessRow[];
    convertBanner: ConvertReadinessBanner;
    recommendation: string;
    salesHint: string;
    commercialWarnings: CommercialWarning[];
    commercialNext: CommercialNextAction[];
  },
): LeadHubApiResponse {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;

  const nextBestAction = deriveLeadNextBestAction(lead);
  const staleLeadSummary = deriveStaleLeadSummary(lead);
  const missingInfo = deriveLeadMissingInfo(lead);
  const operationalSummaryLines = deriveOperationalLeadSummaryLines(lead);

  const workflow: LeadHubWorkflowPayload = {
    nextBestAction,
    staleLeadSummary,
    missingInfo,
    operationalSummaryLines,
  };

  const aiInsights: LeadHubApiResponse["aiInsights"] = [];
  if (nextBestAction) {
    aiInsights.push({
      id: "next-best-action",
      title: nextBestAction.title,
      content: nextBestAction.reason,
    });
  }
  if (staleLeadSummary) {
    aiInsights.push({
      id: "stale-lead",
      title: "Застій",
      content: staleLeadSummary,
    });
  }

  return {
    leadId: lead.id,
    updatedAt: lead.updatedAt.toISOString(),
    lead: {
      title: lead.title,
      source: lead.source,
      stageName: lead.stage.name,
      ownerName: lead.owner.name,
      ownerEmail: lead.owner.email,
    },
    readinessRows: opts.readinessRows,
    convertBanner: opts.convertBanner,
    recommendation: opts.recommendation,
    salesHint: opts.salesHint,
    commercial: {
      warnings: opts.commercialWarnings,
      nextActions: opts.commercialNext,
    },
    estimates: lead.estimates.map((e) => ({
      id: e.id,
      version: e.version,
      status: e.status,
      totalPrice: e.totalPrice,
      updatedAt: e.updatedAt.toISOString(),
    })),
    proposals: lead.proposals.map((p) => ({
      id: p.id,
      version: p.version,
      status: p.status,
      estimateId: p.estimateId,
      hasSnapshot: p.hasSnapshot,
      createdAt: p.createdAt.toISOString(),
    })),
    contactsSummary: {
      primaryName: lead.contact?.fullName ?? lead.contactName,
      phone,
      extraContacts: Math.max(0, lead.leadContacts.length),
    },
    workflow,
    aiInsights,
  };
}
