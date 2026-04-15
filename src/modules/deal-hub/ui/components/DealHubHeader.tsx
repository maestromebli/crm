import type { DealHubOverview } from "../../domain/deal.types";

export function DealHubHeader({ data }: { data: DealHubOverview }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Центр угоди Ultra</p>
          <h2 className="text-lg font-semibold text-slate-900">
            {data.deal.title} <span className="text-slate-400">#{data.deal.code}</span>
          </h2>
          <p className="text-xs text-slate-600">
            {data.client?.name ?? "Клієнта не вказано"} · {data.deal.stageLabel}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Стан</p>
          <p className="text-base font-semibold text-slate-900">
            {data.health.status} · {data.health.score}/100
          </p>
        </div>
      </div>
    </div>
  );
}
