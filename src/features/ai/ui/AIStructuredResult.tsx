"use client";

import type { AiOperationSuccess } from "../core/types";

type Props = {
  payload: AiOperationSuccess;
};

export function AIStructuredResult({ payload }: Props) {
  const { operation, result } = payload;

  if (operation === "lead_summary") {
    return (
      <div className="space-y-2 text-[11px] text-slate-800">
        <p className="font-medium text-[var(--enver-text)]">{result.shortSummary}</p>
        <p>
          <span className="font-semibold text-violet-900">Зараз важливо: </span>
          {result.whatMattersNow}
        </p>
        {result.blockers.length > 0 ? (
          <div>
            <p className="font-semibold text-slate-700">Блокери</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {result.blockers.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {result.nextSteps.length > 0 ? (
          <div>
            <p className="font-semibold text-slate-700">Далі</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {result.nextSteps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (operation === "lead_next_step") {
    return (
      <div className="space-y-2 text-[11px] text-slate-800">
        <p className="font-semibold text-[var(--enver-text)]">
          {result.recommendedAction}
        </p>
        {result.rationale ? (
          <p className="text-slate-600">{result.rationale}</p>
        ) : null}
        {result.checklist.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5">
            {result.checklist.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (operation === "lead_follow_up") {
    return (
      <div className="space-y-3 text-[11px] text-slate-800">
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          Коротко
        </p>
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
          {result.shortVersion}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          Детальніше
        </p>
        <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2">
          {result.detailedVersion}
        </p>
        <p>
          <span className="font-semibold">Заклик до дії: </span>
          {result.ctaSuggestion}
        </p>
      </div>
    );
  }

  if (operation === "lead_risk_explain") {
    const tone =
      result.riskLevel === "high"
        ? "text-rose-800"
        : result.riskLevel === "medium"
          ? "text-amber-900"
          : "text-emerald-900";
    return (
      <div className="space-y-2 text-[11px] text-slate-800">
        <p className={tone}>
          <span className="font-semibold">Рівень ризику: </span>
          {result.riskLevel}
        </p>
        <p>{result.explanation}</p>
        {result.whatToDo.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5">
            {result.whatToDo.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (operation === "proposal_intro") {
    return (
      <div className="space-y-2 text-[11px] text-slate-800">
        <p className="whitespace-pre-wrap leading-relaxed">
          {result.introParagraph}
        </p>
        {result.bullets.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5">
            {result.bullets.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        <p className="text-slate-600">{result.readinessNote}</p>
      </div>
    );
  }

  if (operation === "deal_summary") {
    return (
      <div className="space-y-2 text-[11px] text-slate-800">
        <p className="font-semibold text-[var(--enver-text)]">{result.headline}</p>
        <p className="leading-relaxed">{result.situation}</p>
        {result.blockers.length > 0 ? (
          <div>
            <p className="font-semibold text-slate-700">Блокери</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {result.blockers.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {result.suggestedMoves.length > 0 ? (
          <div>
            <p className="font-semibold text-slate-700">Рух далі</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {result.suggestedMoves.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (operation === "deal_readiness") {
    return (
      <div className="space-y-2 text-[11px] text-slate-800">
        <p className="font-semibold text-[var(--enver-text)]">
          {result.ready ? "Готово до наступного кроку" : "Є блокери"}
        </p>
        <p>{result.summary}</p>
        {result.blockers.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5 text-amber-950">
            {result.blockers.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
        {result.recommendedActions.length > 0 ? (
          <ul className="list-inside list-disc space-y-0.5">
            {result.recommendedActions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (operation === "dashboard_brief") {
    return (
      <div className="grid gap-3 text-[11px] text-slate-800 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-[var(--enver-text)]">Пріоритети</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.priorities.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[var(--enver-text)]">Терміново</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.urgentItems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[var(--enver-text)]">Ризики</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.risks.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-[var(--enver-text)]">Дії</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.managerActions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return null;
}
