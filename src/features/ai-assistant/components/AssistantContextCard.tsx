"use client";

import type { AssistantResolvedContext } from "../types";

type Props = {
  resolved: AssistantResolvedContext;
};

/**
 * Короткий зріз контексту сторінки — без даних з API лише структурні поля.
 */
export function AssistantContextCard({ resolved }: Props) {
  const hasEntityMeta =
    resolved.entityTitle ||
    resolved.status ||
    resolved.missingFields.length > 0 ||
    resolved.overdueTasks > 0;

  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-2">
      <p className="text-[11px] text-slate-500">Сторінка</p>
      <p className="mt-1 text-xs leading-snug text-slate-700">
        {resolved.contextKind !== "unknown"
          ? labelKind(resolved.contextKind)
          : "розділ"}
        <span className="text-slate-400"> · </span>
        <span className="break-all text-slate-500">{resolved.route}</span>
      </p>
      {hasEntityMeta ? (
        <dl className="mt-2 space-y-1 border-t border-slate-200/80 pt-2 text-[11px] text-slate-600">
          {resolved.entityTitle ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Об’єкт</dt>
              <dd className="max-w-[65%] truncate text-right font-medium text-slate-800">
                {resolved.entityTitle}
              </dd>
            </div>
          ) : null}
          {resolved.status ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Статус</dt>
              <dd>{resolved.status}</dd>
            </div>
          ) : null}
          {resolved.missingFields.length > 0 ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Не заповнено</dt>
              <dd>{resolved.missingFields.length} пол.</dd>
            </div>
          ) : null}
          {resolved.overdueTasks > 0 ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Прострочені задачі</dt>
              <dd className="font-medium text-slate-800">
                {resolved.overdueTasks}
              </dd>
            </div>
          ) : null}
          {resolved.staleSinceHours != null ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Без контакту</dt>
              <dd>{resolved.staleSinceHours} год.</dd>
            </div>
          ) : null}
          {resolved.quoteStatus ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">КП</dt>
              <dd className="truncate">{resolved.quoteStatus}</dd>
            </div>
          ) : null}
          {resolved.paymentStatus ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Оплата</dt>
              <dd className="truncate">{resolved.paymentStatus}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] text-slate-500">
          Додаткові поля з’являться, коли відкрито картку об’єкта.
        </p>
      )}
    </div>
  );
}

function labelKind(
  k: AssistantResolvedContext["contextKind"],
): string {
  const m: Record<AssistantResolvedContext["contextKind"], string> = {
    dashboard: "Дашборд",
    lead: "Лід",
    deal: "Угода",
    calculation: "Розрахунок",
    quote: "КП",
    contract: "Договір",
    calendar: "Календар",
    unknown: "Розділ",
  };
  return m[k];
}
