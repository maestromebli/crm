"use client";

import type {
  CalculationAIInput,
  CalculationAISuggestion,
  CalculationAIWarning,
} from "./calculationAIEngine";

export function buildCalculationAIWarnings(
  input: CalculationAIInput,
  suggestions: CalculationAISuggestion[],
): CalculationAIWarning[] {
  const warnings: CalculationAIWarning[] = [];
  for (const row of input.rows) {
    if (!row.name.trim()) {
      warnings.push({
        id: `row:${row.id}:empty-name`,
        severity: "warning",
        message: "Порожня назва рядка.",
        rowId: row.id,
      });
    }
    if (row.price <= 0) {
      warnings.push({
        id: `row:${row.id}:empty-price`,
        severity: "critical",
        message: "Не задано ціну.",
        rowId: row.id,
      });
    }
    if (row.qty < 0 || row.coeff < 0 || row.amount < 0) {
      warnings.push({
        id: `row:${row.id}:negative-value`,
        severity: "critical",
        message: "Виявлено від'ємне значення.",
        rowId: row.id,
      });
    }
    const expected = row.qty * row.coeff * row.price;
    if (Math.abs(expected - row.amount) > 0.01) {
      warnings.push({
        id: `row:${row.id}:mismatch-total`,
        severity: "warning",
        message: "Сума рядка не відповідає qty * coeff * price.",
        rowId: row.id,
      });
    }
  }

  const suggestedRiskCount = suggestions.filter((x) => x.type === "structure").length;
  if (suggestedRiskCount > 0) {
    warnings.push({
      id: "global:missing-components",
      severity: "warning",
      message: `Є ${suggestedRiskCount} потенційно пропущених компонентів.`,
    });
  }

  if (input.totals.saleTotal <= input.totals.costTotal) {
    warnings.push({
      id: "global:no-margin",
      severity: "critical",
      message: "Сума продажу не перекриває собівартість.",
    });
  }

  return warnings.slice(0, 24);
}
