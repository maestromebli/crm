import type { ProductionStepKey } from "../../types/production";

const STEP_BASE_READINESS: Record<ProductionStepKey, number> = {
  ACCEPTED_BY_CHIEF: 10,
  CONSTRUCTOR_ASSIGNED: 15,
  CONSTRUCTOR_IN_PROGRESS: 30,
  FILES_PACKAGE_UPLOADED: 50,
  FILES_VALIDATED: 70,
  APPROVED_BY_CHIEF: 85,
  TASKS_DISTRIBUTED: 100,
};

export function computeReadinessPercent(input: {
  currentStepKey: ProductionStepKey;
  blockersCount: number;
  unresolvedQuestionsCount: number;
  isOverdue: boolean;
}): number {
  const base = STEP_BASE_READINESS[input.currentStepKey] ?? 0;
  const blockerPenalty = Math.min(input.blockersCount * 7, 25);
  const questionPenalty = Math.min(input.unresolvedQuestionsCount * 3, 12);
  const overduePenalty = input.isOverdue ? 10 : 0;
  return Math.max(0, Math.min(100, base - blockerPenalty - questionPenalty - overduePenalty));
}

export function computeRiskScore(input: {
  blockersCount: number;
  unresolvedQuestionsCount: number;
  stationOverloadCount: number;
  rejectedApprovalCount: number;
  isOverdue: boolean;
  missingFilePackageAfterConstructorDueDate: boolean;
}): number {
  let score = 0;
  score += Math.min(input.blockersCount * 20, 40);
  score += Math.min(input.unresolvedQuestionsCount * 5, 15);
  score += Math.min(input.stationOverloadCount * 10, 20);
  score += Math.min(input.rejectedApprovalCount * 15, 15);
  if (input.isOverdue) score += 15;
  if (input.missingFilePackageAfterConstructorDueDate) score += 20;
  return Math.max(0, Math.min(100, score));
}
