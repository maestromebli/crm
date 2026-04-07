import type { DealWorkspacePayload } from "../../deal-workspace/types";
import type { SessionUser } from "../../../lib/authz/api-guard";
import {
  canViewCostInAi,
  canViewMarginInAi,
  canViewPaymentsInAi,
} from "../policies/ai-data-policy";

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/**
 * Урізана вибірка з робочого місця угоди для ШІ (без повних текстів договорів).
 */
export function serializeDealForAi(
  data: DealWorkspacePayload,
  user: SessionUser,
): string {
  const pay = canViewPaymentsInAi(user);
  const cost = canViewCostInAi(user);
  const margin = canViewMarginInAi(user);

  const readiness = data.readiness.map((r) => ({
    id: r.id,
    label: r.label,
    done: r.done,
    blockerMessage: r.blockerMessage,
  }));

  const payload = {
    deal: {
      title: data.deal.title,
      status: data.deal.status,
      value: pay ? data.deal.value : null,
      currency: pay ? data.deal.currency : null,
      valueHidden: !pay,
      stage: data.stage.name,
      expectedClose: data.deal.expectedCloseDate,
    },
    client: data.client.name,
    pipeline: data.pipeline.name,
    operational: data.operationalStats,
    financeProjects:
      pay || cost || margin
        ? data.linkedFinanceProjects
        : data.linkedFinanceProjects.map((p) => ({
            id: p.id,
            code: p.code,
            title: "[приховано за правами]",
            status: p.status,
          })),
    readinessSummary: {
      allMet: data.readinessAllMet,
      checks: readiness,
    },
    contract: data.contract
      ? { status: data.contract.status, version: data.contract.version }
      : null,
    handoff: { status: data.handoff.status },
    production: data.productionLaunch,
    attachmentsByCategory: data.attachmentsByCategory,
    leadMessagesPreview: data.leadMessagesPreview.map((m) => ({
      at: m.createdAt,
      kind: m.interactionKind,
      body: truncate(m.body, 400),
    })),
    notes: {
      canSeeFinanceDetail: pay,
      canSeeCost: cost,
      canSeeMargin: margin,
    },
  };

  return JSON.stringify(payload, null, 0);
}
