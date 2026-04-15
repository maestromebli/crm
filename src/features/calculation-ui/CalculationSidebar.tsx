"use client";

import type {
  CalculationAINextAction,
  CalculationAISuggestion,
  CalculationAIWarning,
} from "../calculation-ai/calculationAIEngine";
import { CalculationAIWidget } from "./CalculationAIWidget";
import { CalculationSummary } from "./CalculationSummary";
import type { CalculationTotals } from "./calculationStore";

type Props = {
  totals: CalculationTotals;
  suggestions: CalculationAISuggestion[];
  warnings: CalculationAIWarning[];
  actions: CalculationAINextAction[];
  onChangeMarkup: (markupPercent: number) => void;
  onApplySuggestion: (suggestion: CalculationAISuggestion) => void;
  onRunAction: (action: CalculationAINextAction) => void;
};

export function CalculationSidebar({
  totals,
  suggestions,
  warnings,
  actions,
  onChangeMarkup,
  onApplySuggestion,
  onRunAction,
}: Props) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-[76px] lg:h-fit">
      <CalculationSummary totals={totals} onChangeMarkup={onChangeMarkup} />
      <CalculationAIWidget
        suggestions={suggestions}
        warnings={warnings}
        actions={actions}
        onApplySuggestion={onApplySuggestion}
        onRunAction={onRunAction}
      />
    </aside>
  );
}
