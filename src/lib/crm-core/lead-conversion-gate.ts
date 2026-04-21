import { evaluateLeadCheck } from "./lead-checks";
import type { LeadCoreInput } from "./lead-input.types";
import type { ConversionGateResult, LeadStageKey } from "./lead-stage.types";

const IDEAL_CONVERSION_STAGES: ReadonlySet<LeadStageKey> = new Set([
  "APPROVED",
  "CLIENT",
  "CONTRACT",
  "DEAL",
  "PRODUCTION_READY",
]);

/**
 * Перевірка можливості конвертації ліда в замовлення (без UI).
 */
export function validateLeadConversionToDeal(
  lead: LeadCoreInput,
): ConversionGateResult {
  const errors: ConversionGateResult["errors"] = [];
  const warnings: ConversionGateResult["warnings"] = [];

  if (lead.dealId) {
    errors.push({
      code: "ALREADY_CONVERTED",
      messageUa: "Лід уже пов’язаний з замовленням.",
    });
    return { ok: false, errors, warnings };
  }

  const owner = evaluateLeadCheck("owner_assigned", "required", lead);
  if (!owner.pass) {
    errors.push({ code: "NO_OWNER", messageUa: owner.hintUa ?? owner.labelUa });
  }

  const contact = evaluateLeadCheck("contact_channel", "required", lead);
  if (!contact.pass) {
    errors.push({
      code: "NO_CONTACT",
      messageUa: contact.hintUa ?? contact.labelUa,
    });
  }

  const prop = lead.commercial.latestProposal;
  const approved =
    prop?.status === "APPROVED" || lead.projectAgreed === true;

  if (!approved) {
    errors.push({
      code: "NO_APPROVED_PROPOSAL",
      messageUa:
        "Потрібне погоджене КП або підтвердження умов (projectAgreed).",
    });
  }

  const amount = evaluateLeadCheck(
    "approved_amount_documented",
    "required",
    lead,
  );
  if (!amount.pass && approved) {
    warnings.push({
      code: "AMOUNT_WEAK",
      messageUa:
        amount.hintUa ??
        "Перевірте, що сума в сметі відповідає узгодженому КП.",
    });
  }

  if (
    approved &&
    !IDEAL_CONVERSION_STAGES.has(lead.stageKey) &&
    prop?.status === "APPROVED"
  ) {
    warnings.push({
      code: "STAGE_EARLY",
      messageUa:
        "КП погоджено, але стадія воронки ще не «закрита» — перевірте відповідність процесу.",
    });
  }

  const budget = evaluateLeadCheck("budget_range_documented", "soft", lead);
  if (!budget.pass) {
    warnings.push({
      code: "BUDGET_MISSING",
      messageUa: "Бюджет не зафіксовано — рекомендуємо для замовлення.",
    });
  }

  const activeEst = evaluateLeadCheck("active_estimate", "required", lead);
  if (!activeEst.pass) {
    warnings.push({
      code: "NO_ACTIVE_ESTIMATE",
      messageUa: activeEst.hintUa ?? "Немає активної версії смети.",
    });
  }

  const ok = errors.length === 0;
  return { ok, errors, warnings };
}
