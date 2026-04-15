import { evaluateLeadChecksForStage } from "./lead-checks";
import type { LeadCoreInput } from "./lead-input.types";
import { getLeadDominantNextStep } from "./lead-next-step";
import { computeLeadReadiness } from "./lead-readiness";
import { getStageConfig } from "./lead-stage.config";
import type {
  LeadCheckId,
  LeadDominantCta,
  LeadStageKey,
} from "./lead-stage.types";
import { isTerminalStageKey } from "./lead-stage-resolve";
import { validateLeadStageTransition } from "./lead-transition";

/** Лінійний порядок воронки для UI та «наступного» канонічного етапу. */
export const LEAD_FUNNEL_LINEAR: readonly LeadStageKey[] = [
  "NEW",
  "CONTACT",
  "MEASUREMENT",
  "CALCULATION",
  "QUOTE_DRAFT",
  "QUOTE_SENT",
  "APPROVED",
  "DEAL",
  "PRODUCTION_READY",
] as const;

const FUNNEL_LINEAR: LeadStageKey[] = [...LEAD_FUNNEL_LINEAR];
const LEGACY_POST_APPROVED_STAGES = new Set<LeadStageKey>([
  "CLIENT",
  "CONTROL_MEASUREMENT",
  "CONTRACT",
]);

/**
 * Наступний канонічний етап у лінійній воронці (для підказок і CTA).
 * Не завжди дорівнює одному кліку зміни `stageId` у БД — див. `allowedNext` у конфігу.
 */
export function getNextStage(stage: LeadStageKey): LeadStageKey | null {
  if (isTerminalStageKey(stage)) return null;
  if (LEGACY_POST_APPROVED_STAGES.has(stage)) {
    return "DEAL";
  }
  const i = FUNNEL_LINEAR.indexOf(stage);
  if (i < 0) return null;
  const next = FUNNEL_LINEAR[i + 1];
  return next ?? null;
}

export type LeadFlowBlocking = {
  transitionOk: boolean;
  transitionErrorsUa: string[];
  missingRequiredIds: LeadCheckId[];
  missingMessagesUa: string[];
};

/**
 * Чи виконані обов’язкові перевірки для переходу на `target` (за замовчуванням — наступний у воронці).
 */
export function canAdvance(
  stage: LeadStageKey,
  context: LeadCoreInput,
  target?: LeadStageKey,
): boolean {
  const next = target ?? getNextStage(stage);
  if (!next) return false;
  const block = getBlockingReasons(stage, context, next);
  return block.transitionOk && block.missingRequiredIds.length === 0;
}

/**
 * Блокери та відсутні вимоги для переходу на цільовий етап.
 */
export function getBlockingReasons(
  stage: LeadStageKey,
  context: LeadCoreInput,
  forTarget?: LeadStageKey,
): LeadFlowBlocking {
  const target = forTarget ?? getNextStage(stage);
  if (!target) {
    return {
      transitionOk: false,
      transitionErrorsUa: ["Немає наступного етапу в моделі воронки."],
      missingRequiredIds: [],
      missingMessagesUa: [],
    };
  }

  const t = validateLeadStageTransition(stage, target, context);
  if (!t.ok) {
    return {
      transitionOk: false,
      transitionErrorsUa: t.errors.map((e) => e.messageUa),
      missingRequiredIds: [],
      missingMessagesUa: [],
    };
  }

  const cfg = getStageConfig(target);
  const checks = evaluateLeadChecksForStage(
    context,
    cfg.requiredChecks,
    cfg.softChecks,
  );
  const reqFailed = checks.required.filter((c) => !c.pass);
  return {
    transitionOk: true,
    transitionErrorsUa: [],
    missingRequiredIds: reqFailed.map((c) => c.id),
    missingMessagesUa: reqFailed.map((c) => c.hintUa ?? c.labelUa),
  };
}

/** Домінантний CTA (той самий контракт, що й Hub «Наступний крок»). */
export function getCTA(context: LeadCoreInput): LeadDominantCta {
  return getLeadDominantNextStep(context);
}

/** Агрегат готовності поточної стадії (чекліст + рівень). */
export function getStageReadinessSnapshot(context: LeadCoreInput) {
  return computeLeadReadiness(context);
}
