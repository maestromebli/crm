import { getNextProductionAction } from "./getNextProductionAction";
import type { ChecklistItem, ProductionOrderOpsState, ProductionStatusSnapshot } from "../types/operations-core";

function buildReadinessChecklist(state: ProductionOrderOpsState): ChecklistItem[] {
  return [
    { id: "calc", label: "Погоджений розрахунок", done: state.approvedCalculationExists, critical: true },
    { id: "files", label: "Погоджені файли/креслення", done: state.approvedFilesExist, critical: true },
    { id: "measure", label: "Контрольний замір", done: state.measurementCompleted, critical: true },
    { id: "contract", label: "Договір підтверджено", done: state.contractConfirmed, critical: true },
    { id: "payment", label: "Обов'язкова оплата отримана", done: state.paymentConfirmed, critical: true },
    { id: "comments", label: "Критичні коментарі закриті", done: state.commentsResolved },
  ];
}

function inferCurrentStatus(state: ProductionOrderOpsState): string {
  if (!state.constructorAssigned) return "Очікує призначення конструктора";
  if (!state.drawingsApproved) return "Конструкторський етап";
  if (!state.splitCompleted) return "Готово до split у закупівлю/цех";
  if (state.productionStage && state.productionStage !== "READY") return "У виробництві";
  if (state.productionStage === "READY" && state.installationStatus !== "COMPLETED") return "Готово до монтажу";
  if (state.installationStatus === "COMPLETED") return "Замовлення завершено";
  return "У роботі";
}

export function productionStatusEngine(state: ProductionOrderOpsState): ProductionStatusSnapshot {
  const checklist = buildReadinessChecklist(state);
  const checksDone = checklist.filter((item) => item.done).length;
  const criticalMissing = checklist.filter((item) => item.critical && !item.done).length;
  const blockerPenalty = Math.min(35, state.blockers.length * 8);
  const criticalPenalty = criticalMissing * 10;
  const readinessPercent = Math.max(0, Math.min(100, Math.round((checksDone / checklist.length) * 100 - blockerPenalty - criticalPenalty)));

  return {
    currentStatus: inferCurrentStatus(state),
    nextAction: getNextProductionAction(state),
    blockers: state.blockers,
    readinessPercent,
    checklist,
  };
}
