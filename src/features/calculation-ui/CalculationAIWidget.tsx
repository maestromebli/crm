"use client";

import type {
  CalculationAINextAction,
  CalculationAISuggestion,
  CalculationAIWarning,
} from "../calculation-ai/calculationAIEngine";

type Props = {
  suggestions: CalculationAISuggestion[];
  warnings: CalculationAIWarning[];
  actions: CalculationAINextAction[];
  onApplySuggestion: (suggestion: CalculationAISuggestion) => void;
  onRunAction: (action: CalculationAINextAction) => void;
};

export function CalculationAIWidget({
  suggestions,
  warnings,
  actions,
  onApplySuggestion,
  onRunAction,
}: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">AI Асистент</h3>
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ризики</p>
          <ul className="mt-1 space-y-1">
            {warnings.slice(0, 4).map((warning) => (
              <li key={warning.id} className="text-xs text-amber-700">
                ⚠ {warning.message}
              </li>
            ))}
            {warnings.length === 0 ? <li className="text-xs text-emerald-700">Немає критичних ризиків</li> : null}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Рекомендації</p>
          <div className="mt-2 space-y-2">
            {suggestions.slice(0, 4).map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs transition hover:bg-slate-50"
                onClick={() => onApplySuggestion(suggestion)}
              >
                <p className="font-semibold text-slate-900">{suggestion.title}</p>
                <p className="mt-0.5 text-slate-600">{suggestion.message}</p>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Дії</p>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onRunAction(action)}
                className={
                  action.tone === "accent"
                    ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    : action.tone === "danger"
                      ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                      : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                }
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
