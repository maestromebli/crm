import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealNextActionsPanel(props: {
  data: DealHubOverview;
  onRunAction: (action: string) => void;
}) {
  return (
    <DealCard title="Що потрібно зробити зараз" subtitle="Черга виконання з урахуванням ролей">
      <div className="space-y-2">
        {props.data.nextActions.map((action) => (
          <div key={action.id} className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-900">{action.title}</p>
                {action.description ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">{action.description}</p>
                ) : null}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                {action.ownerRole}
              </span>
            </div>
            {action.command ? (
              <button
                type="button"
                className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                onClick={() => props.onRunAction(action.command!)}
              >
                Запустити
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </DealCard>
  );
}
