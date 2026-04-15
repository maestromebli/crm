"use client";

import type {
  CalculationAIInput,
  CalculationAINextAction,
  CalculationAIWarning,
} from "./calculationAIEngine";

export function buildCalculationAIActions(
  input: CalculationAIInput,
  warnings: CalculationAIWarning[],
): CalculationAINextAction[] {
  const actions: CalculationAINextAction[] = [
    {
      id: "action:create-quote",
      label: "Створити КП",
      tone: "accent",
      type: "create-quote",
    },
    {
      id: "action:recalculate",
      label: "Перерахувати",
      tone: "default",
      type: "recalculate",
    },
  ];

  if (input.totals.marginPercent < 24) {
    actions.push({
      id: "action:raise-margin",
      label: "Підняти ціну на 10%",
      tone: "default",
      type: "raise-margin",
      payload: { percent: 10 },
    });
  }

  const hasInstall = input.rows.some((x) => x.type === "service" && /монтаж/i.test(x.name));
  if (!hasInstall) {
    actions.push({
      id: "action:add-installation",
      label: "Додати монтаж",
      tone: "default",
      type: "add-installation",
    });
  }

  const criticalWarnings = warnings.filter((x) => x.severity === "critical").length;
  if (criticalWarnings > 0) {
    actions.push({
      id: "action:add-standards",
      label: "Додати стандартні матеріали",
      tone: "danger",
      type: "add-standards",
    });
  }

  return actions.slice(0, 6);
}
