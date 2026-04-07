import type {
  LeadHubApiResponse,
  LeadHubSummaryApiResponse,
} from "../contracts/addon-ui-backend-contracts";
import { fetchJson } from "./http-json";

export function fetchLeadHub(leadId: string) {
  return fetchJson<LeadHubApiResponse>(`/api/leads/${encodeURIComponent(leadId)}/hub`);
}

export function fetchLeadHubSummary(leadId: string) {
  return fetchJson<LeadHubSummaryApiResponse>(
    `/api/leads/${encodeURIComponent(leadId)}/hub-summary`,
  );
}
