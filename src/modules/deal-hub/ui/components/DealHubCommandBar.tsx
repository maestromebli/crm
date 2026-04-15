import type { DealHubOverview } from "../../domain/deal.types";

export function DealHubCommandBar(props: {
  data: DealHubOverview;
  onRunAction: (action: string) => void;
  isBusy?: boolean;
}) {
  const actions = [
    { key: "approve-kp", label: "Погодити КП" },
    { key: "generate-contract", label: "Згенерувати договір" },
    { key: "mark-deposit-received", label: "Позначити отримання авансу" },
    { key: "schedule-measurement", label: "Запланувати замір" },
    { key: "release-production", label: "Передати у виробництво" },
    { key: "schedule-installation", label: "Запланувати монтаж" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-700">Панель команд</p>
        <span className="text-[11px] text-slate-500">Етап: {props.data.deal.stageLabel}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={props.isBusy}
            onClick={() => props.onRunAction(action.key)}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
