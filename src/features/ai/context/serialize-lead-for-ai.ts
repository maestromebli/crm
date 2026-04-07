import type { LeadDetailRow } from "../../leads/queries";
import {
  buildLeadAiHints,
  computeLeadReadiness,
  computeLeadRisks,
  mapLeadDetailRowToCoreInput,
  readinessBlockerMessages,
} from "../../../lib/crm-core";

/**
 * Стислий нормалізований контекст для промптів (без сирих великих об'єктів).
 */
export function serializeLeadForAi(lead: LeadDetailRow): string {
  const core = mapLeadDetailRowToCoreInput(lead);
  const readiness = computeLeadReadiness(core);
  const risks = computeLeadRisks(core);
  const hints = buildLeadAiHints(core);

  const payload = {
    id: lead.id,
    title: lead.title,
    stage: { name: lead.stage.name, slug: lead.stage.slug },
    pipeline: lead.pipeline.name,
    priority: lead.priority,
    source: lead.source,
    owner: lead.owner.name ?? lead.owner.email,
    contact: {
      name: lead.contactName,
      hasValidPhoneOrEmail: core.contact.hasValidPhoneOrEmail,
    },
    nextStep: lead.nextStep,
    nextContactAt: lead.nextContactAt?.toISOString() ?? null,
    lastActivityAt: lead.lastActivityAt?.toISOString() ?? null,
    qualification: {
      needsSummary: core.qualification.needsSummary,
      budgetRange: core.qualification.budgetRange,
      measurement: core.qualification.measurementDecision,
    },
    commercial: {
      activeEstimateId: core.commercial.activeEstimateId,
      activeProposalId: core.commercial.activeProposalId,
      estimatesCount: core.commercial.estimates.length,
      latestEstimateVersion: core.commercial.latestEstimate?.version ?? null,
      latestProposal: core.commercial.latestProposal
        ? {
            status: core.commercial.latestProposal.status,
            version: core.commercial.latestProposal.version,
            sentAt: core.commercial.latestProposal.sentAt,
            approvedAt: core.commercial.latestProposal.approvedAt,
            estimateId: core.commercial.latestProposal.estimateId,
          }
        : null,
    },
    readiness: {
      level: readiness.level,
      headline: readiness.headlineUa,
      blockers: readinessBlockerMessages(readiness.blockers).slice(0, 8),
    },
    deterministicRisks: risks.items.slice(0, 6).map((r) => ({
      severity: r.severity,
      text: r.messageUa,
    })),
    deterministicHints: hints.slice(0, 8).map((h) => h.textUa),
    linkedDeal: lead.linkedDeal,
  };

  return JSON.stringify(payload, null, 0);
}
