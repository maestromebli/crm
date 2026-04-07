import type { LeadDetailRow } from "../../features/leads/queries";
import {
  computeLeadReadiness,
  mapLeadDetailRowToCoreInput,
  primaryLeadAiHint,
} from "../crm-core";

/** Легкі евристики без виклику API — джерело: CRM Core (`lead-ai-hints` + readiness). */
export function deriveLeadSalesHint(lead: LeadDetailRow): string {
  const input = mapLeadDetailRowToCoreInput(lead);
  const primary = primaryLeadAiHint(input);
  if (primary) return primary;
  return computeLeadReadiness(input).headlineUa;
}
