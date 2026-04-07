import type { DealContractStatus } from "@prisma/client";
import {
  type EnverStageName,
  nextEnverStage,
  normalizeEnverStage,
} from "./stages";

export type DealFlowSnapshot = {
  currentStageName: string;
  currentStageSlug?: string | null;
  hasEstimate: boolean;
  hasQuote: boolean;
  quoteApproved: boolean;
  contractSigned: boolean;
  payment70Done: boolean;
  procurementCreated: boolean;
  productionStarted: boolean;
};

export type StageChecklistItem = {
  key: string;
  label: string;
  done: boolean;
};

export type FlowValidationResult = {
  ok: boolean;
  stage: EnverStageName | null;
  nextStage: EnverStageName | null;
  checklist: StageChecklistItem[];
  blockers: string[];
};

export function isContractSigned(status: DealContractStatus | null): boolean {
  return status === "FULLY_SIGNED";
}

function boolItem(key: string, label: string, done: boolean): StageChecklistItem {
  return { key, label, done };
}

export function checklistForStage(
  stage: EnverStageName,
  deal: DealFlowSnapshot,
): StageChecklistItem[] {
  switch (stage) {
    case "Розрахунок":
      return [boolItem("hasEstimate", "Є розрахунок / смета", deal.hasEstimate)];
    case "КП":
      return [boolItem("hasQuote", "КП сформовано", deal.hasQuote)];
    case "Погоджені":
      return [boolItem("quoteApproved", "КП погоджено клієнтом", deal.quoteApproved)];
    case "Договір":
      return [boolItem("contractSigned", "Договір підписано", deal.contractSigned)];
    case "Оплата":
      return [boolItem("payment70Done", "Передоплата 70% отримана", deal.payment70Done)];
    case "Закупка":
      return [
        boolItem("procurementCreated", "Закупівлю / PO створено", deal.procurementCreated),
      ];
    case "Виробництво":
      return [
        boolItem("productionStarted", "Виробництво запущено", deal.productionStarted),
      ];
    default:
      return [];
  }
}

export function canMoveToNextStage(deal: DealFlowSnapshot): FlowValidationResult {
  const stage =
    normalizeEnverStage(deal.currentStageName) ??
    normalizeEnverStage(deal.currentStageSlug);
  if (!stage) {
    return {
      ok: true,
      stage: null,
      nextStage: null,
      checklist: [],
      blockers: [],
    };
  }

  const checklist = checklistForStage(stage, deal);
  const blockers = checklist.filter((x) => !x.done).map((x) => x.label);
  return {
    ok: blockers.length === 0,
    stage,
    nextStage: nextEnverStage(stage),
    checklist,
    blockers,
  };
}
