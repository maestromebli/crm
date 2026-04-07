"use client";

import { useMemo } from "react";
import {
  buildLeadAiHints,
  computeLeadRisks,
  getBlockingReasons,
  getCTA,
  getNextStage,
  getStageReadinessSnapshot,
  mapLeadDetailRowToCoreInput,
  type LeadCoreInput,
} from "../../lib/crm-core";
import type { LeadDetailRow } from "./queries";

function toCore(lead: LeadDetailRow): LeadCoreInput {
  return mapLeadDetailRowToCoreInput(lead);
}

/** Наступна дія та блокери з CRM Core (правила, без окремої сторінки AI). */
export function useAINextAction(lead: LeadDetailRow) {
  return useMemo(() => {
    const core = toCore(lead);
    const cta = getCTA(core);
    const block = getBlockingReasons(core.stageKey, core);
    return { cta, block, core };
  }, [lead]);
}

/** Перевірка узгодженості стадії з даними (готовність + наступний етап). */
export function useAIStageCheck(lead: LeadDetailRow) {
  return useMemo(() => {
    const core = toCore(lead);
    const readiness = getStageReadinessSnapshot(core);
    const next = getNextStage(core.stageKey);
    return { readiness, nextCanonicalStage: next, core };
  }, [lead]);
}

/** Заготовка під чернетку повідомлення клієнту (розширити викликом до `/api/.../ai-reply` за потреби). */
export function useAIMessageDraft(lead: LeadDetailRow) {
  return useMemo(() => {
    const core = toCore(lead);
    const phone = core.contact.hasValidPhoneOrEmail
      ? "Контакт є — коротко підтвердіть наступний крок."
      : "Уточніть зручний канал зв’язку (телефон / месенджер).";
    return {
      suggestedOpeningUa: `Вітаю! По ліду «${lead.title.trim()}»: ${phone}`,
      core,
    };
  }, [lead]);
}

export function useAIRiskHints(lead: LeadDetailRow) {
  return useMemo(() => {
    const core = toCore(lead);
    const risks = computeLeadRisks(core);
    const hints = buildLeadAiHints(core);
    return { risks, hints, core };
  }, [lead]);
}
