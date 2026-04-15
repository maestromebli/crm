import Link from "next/link";
import { Activity, AlertTriangle, Gauge } from "lucide-react";
import type { BehaviorEngineSnapshot } from "../executive-types";

type BehaviorEngineCardProps = {
  data: BehaviorEngineSnapshot;
};

export function BehaviorEngineCard({ data }: BehaviorEngineCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-600" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--enver-text)]">
            Behavior Engine
          </h2>
        </div>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
          Team {data.teamBehaviorScore}/100
        </span>
      </div>

      {data.weakManagers.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--enver-text-muted)]">
          Критичних просадок дисципліни не виявлено.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.weakManagers.slice(0, 4).map((manager) => (
            <li
              key={manager.userId}
              className="rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-950">
                  {manager.name}
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {manager.score}/100
                </span>
              </div>
              <p className="mt-1 text-sm text-amber-900">
                Основна проблема: {manager.primaryIssue}
              </p>
            </li>
          ))}
        </ul>
      )}

      {data.alerts.length > 0 ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2">
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-rose-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            Операційні сигнали
          </p>
          <ul className="mt-1 space-y-1">
            {data.alerts.slice(0, 2).map((a) => (
              <li key={a.id} className="text-xs text-rose-900">
                {a.label}
              </li>
            ))}
          </ul>
          <Link
            href="/crm/dashboard?view=issues"
            className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-[var(--enver-accent-hover)] hover:underline"
          >
            <Gauge className="h-3.5 w-3.5" />
            Відкрити risk view
          </Link>
        </div>
      ) : null}
    </div>
  );
}
