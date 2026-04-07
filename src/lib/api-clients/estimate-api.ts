import { fetchJson } from "./http-json";

export type LeadEstimateListItem = {
  id: string;
  version: number;
  status: string;
  totalPrice: number | null;
  templateKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export function listLeadEstimates(leadId: string) {
  return fetchJson<{ items: LeadEstimateListItem[] }>(
    `/api/leads/${encodeURIComponent(leadId)}/estimates`,
  );
}

export function createLeadEstimate(
  leadId: string,
  body: { templateKey?: string | null; cloneFromEstimateId?: string | null } = {},
) {
  return fetchJson<{
    ok: boolean;
    estimate: {
      id: string;
      version: number;
      status: string;
      totalPrice: number | null;
      templateKey: string | null;
      createdAt: string;
    };
  }>(`/api/leads/${encodeURIComponent(leadId)}/estimates`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Повне тіло смети — тип залежить від `serializeEstimateForClient` на бекенді. */
export function getLeadEstimate(leadId: string, estimateId: string) {
  return fetchJson<{ estimate: Record<string, unknown> }>(
    `/api/leads/${encodeURIComponent(leadId)}/estimates/${encodeURIComponent(estimateId)}`,
  );
}

export function patchLeadEstimate(
  leadId: string,
  estimateId: string,
  body: Record<string, unknown>,
) {
  return fetchJson<unknown>(
    `/api/leads/${encodeURIComponent(leadId)}/estimates/${encodeURIComponent(estimateId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function postLeadEstimateAiDraft(leadId: string, prompt: string) {
  return fetchJson<{ ok: true; draft: unknown }>(
    `/api/leads/${encodeURIComponent(leadId)}/estimates/ai-draft`,
    { method: "POST", body: JSON.stringify({ prompt }) },
  );
}
