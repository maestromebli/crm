"use client";

import type { DealWorkspacePayload } from "../deal-workspace/types";
import type { CalculationRow, CalculationTotals } from "../calculation-ui/calculationStore";
import { buildCalculationAISuggestions } from "./calculationAISuggestions";
import { buildCalculationAIWarnings } from "./calculationAIValidator";
import { buildCalculationAIActions } from "./calculationAIActions";

export type CalculationAISuggestionType =
  | "autofill"
  | "pricing"
  | "structure"
  | "risk"
  | "next-action";

export type CalculationAISuggestion = {
  id: string;
  type: CalculationAISuggestionType;
  title: string;
  message: string;
  rowId?: string;
  patch?: Partial<CalculationRow>;
  confidence: number;
};

export type CalculationAIWarningSeverity = "info" | "warning" | "critical";

export type CalculationAIWarning = {
  id: string;
  severity: CalculationAIWarningSeverity;
  message: string;
  rowId?: string;
};

export type CalculationAINextAction = {
  id: string;
  label: string;
  tone: "default" | "accent" | "danger";
  type: "raise-margin" | "add-installation" | "add-standards" | "create-quote" | "recalculate";
  payload?: Record<string, string | number | boolean>;
};

export type CalculationAIResult = {
  suggestions: CalculationAISuggestion[];
  warnings: CalculationAIWarning[];
  actions: CalculationAINextAction[];
};

export type CalculationAIInput = {
  rows: CalculationRow[];
  totals: CalculationTotals;
  dealContext: {
    budgetText: string | null;
    clientType: string;
    dealTitle: string;
  };
};

export function buildCalculationAIInput(
  rows: CalculationRow[],
  totals: CalculationTotals,
  workspacePayload?: DealWorkspacePayload,
): CalculationAIInput {
  const budgetText = workspacePayload?.leadMessagesPreview?.find((x) =>
    x.body.toLowerCase().includes("бюджет"),
  )?.body;
  return {
    rows,
    totals,
    dealContext: {
      budgetText: budgetText ?? null,
      clientType: workspacePayload?.client.type ?? "UNKNOWN",
      dealTitle: workspacePayload?.deal.title ?? "Untitled deal",
    },
  };
}

export function runCalculationAI(input: CalculationAIInput): CalculationAIResult {
  const suggestions = buildCalculationAISuggestions(input);
  const warnings = buildCalculationAIWarnings(input, suggestions);
  const actions = buildCalculationAIActions(input, warnings);
  return {
    suggestions,
    warnings,
    actions,
  };
}
