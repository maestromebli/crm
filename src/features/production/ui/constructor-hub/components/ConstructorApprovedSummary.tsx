"use client";

import type { ConstructorApprovedSummary as ApprovedSummary } from "../constructor-hub.types";

export function ConstructorApprovedSummary({ data }: { data: ApprovedSummary }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Погоджено</h3>
      <ul className="mt-3 space-y-2 text-xs">
        {data.lines.length === 0 ? (
          <li className="rounded-lg border border-dashed border-slate-300 px-2 py-3 text-center text-slate-500">Поки немає погоджених даних.</li>
        ) : null}
        {data.lines.map((line) => (
          <li key={line.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-800">{line.label}</p>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  line.state === "APPROVED" ? "bg-emerald-500" : line.state === "MISSING" ? "bg-rose-500" : "bg-amber-500"
                }`}
              />
            </div>
            <p className="mt-1 text-slate-600">{line.summary}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
