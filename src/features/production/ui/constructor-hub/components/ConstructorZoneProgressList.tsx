"use client";

import type { ConstructorZoneProgress } from "../constructor-hub.types";

export function ConstructorZoneProgressList({ zones }: { zones: ConstructorZoneProgress[] }) {
  if (zones.length === 0) {
    return <p className="text-xs text-slate-500">Прогресс по зонам появится после разметки ТЗ.</p>;
  }
  return (
    <ul className="space-y-3">
      {zones.map((zone) => (
        <li key={zone.id}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-800">{zone.zoneName}</span>
            <span className="tabular-nums text-slate-500">{zone.progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${
                zone.progressPercent >= 80
                  ? "bg-emerald-500"
                  : zone.progressPercent >= 50
                    ? "bg-amber-500"
                    : "bg-sky-500"
              }`}
              style={{ width: `${Math.max(6, zone.progressPercent)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
