import { getStageConfig } from "./lead-stage.config";
import { evaluateLeadChecksForStage } from "./lead-checks";
import type { LeadCoreInput } from "./lead-input.types";
import type { LeadCheckId, LeadStageKey, TransitionValidationResult } from "./lead-stage.types";
import { isTerminalStageKey } from "./lead-stage-resolve";

/**
 * Чи дозволений перехід між канонічними стадіями (правила воронки).
 * Дані ліда перевіряються окремо: `missingRequirements` для цільової стадії.
 */
export function validateLeadStageTransition(
  from: LeadStageKey,
  to: LeadStageKey,
  lead: LeadCoreInput,
): TransitionValidationResult {
  const errors: TransitionValidationResult["errors"] = [];
  const warnings: TransitionValidationResult["warnings"] = [];

  if (from === to) {
    return {
      ok: true,
      errors: [],
      warnings: [
        {
          code: "SAME_STAGE",
          messageUa: "Стадія вже встановлена — змін не потрібно.",
        },
      ],
      missingRequirements: [],
    };
  }

  const fromCfg = getStageConfig(from);
  const toCfg = getStageConfig(to);

  if (isTerminalStageKey(to)) {
    if (isTerminalStageKey(from)) {
      errors.push({
        code: "TERMINAL_LOCKED",
        messageUa: "Фінальну стадію не можна змінити через цей перехід.",
      });
      return { ok: false, errors, warnings, missingRequirements: [] };
    }
  } else if (!fromCfg.allowedNext.includes(to)) {
    errors.push({
      code: "TRANSITION_NOT_ALLOWED",
      messageUa: `З етапу «${fromCfg.labelUa}» не можна перейти безпосередньо на «${toCfg.labelUa}».`,
    });
    return { ok: false, errors, warnings, missingRequirements: [] };
  }

  const targetChecks = evaluateLeadChecksForStage(
    lead,
    toCfg.requiredChecks,
    toCfg.softChecks,
  );
  const reqFailed = targetChecks.required.filter((x) => !x.pass);
  const softFailed = targetChecks.soft.filter((x) => !x.pass);
  const missingRequirements: LeadCheckId[] = [
    ...reqFailed.map((r) => r.id),
    ...softFailed.map((r) => r.id),
  ];

  for (const r of reqFailed) {
    warnings.push({
      code: `MISSING_${r.id}`,
      messageUa: r.hintUa ?? r.labelUa,
    });
  }
  for (const r of softFailed) {
    warnings.push({
      code: `SOFT_${r.id}`,
      messageUa: r.hintUa ?? r.labelUa,
    });
  }

  return {
    ok: true,
    errors: [],
    warnings,
    missingRequirements,
  };
}
