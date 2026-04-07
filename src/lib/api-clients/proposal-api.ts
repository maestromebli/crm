import { fetchJson } from "./http-json";

export function createLeadProposal(leadId: string, estimateId: string) {
  return fetchJson<{
    ok: boolean;
    proposal: { id: string; version: number; status: string; estimateId: string | null };
  }>(`/api/leads/${encodeURIComponent(leadId)}/proposals`, {
    method: "POST",
    body: JSON.stringify({ estimateId }),
  });
}

export function getLeadProposal(leadId: string, proposalId: string) {
  return fetchJson<{
    leadTitle: string;
    proposal: Record<string, unknown>;
  }>(
    `/api/leads/${encodeURIComponent(leadId)}/proposals/${encodeURIComponent(proposalId)}`,
  );
}

export function patchLeadProposal(
  leadId: string,
  proposalId: string,
  body: {
    status?: string;
    title?: string | null;
    summary?: string | null;
    markSent?: boolean;
    quoteItems?: unknown[];
    visualizationUrl?: string | null;
  },
) {
  return fetchJson<{ ok: boolean }>(
    `/api/leads/${encodeURIComponent(leadId)}/proposals/${encodeURIComponent(proposalId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

export function postLeadProposalPdf(leadId: string, proposalId: string) {
  return fetchJson<{
    ok: boolean;
    pdfUrl: string;
    publicPath: string;
    publicToken: string;
  }>(
    `/api/leads/${encodeURIComponent(leadId)}/proposals/${encodeURIComponent(proposalId)}/pdf`,
    { method: "POST" },
  );
}
