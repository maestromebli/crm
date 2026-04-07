"use client";

import { RELATIONS, type RelationSource } from "../../config/relations";

type RelationPanelProps = {
  source: RelationSource;
};

export function RelationPanel({ source }: RelationPanelProps) {
  const configs = RELATIONS.filter(
    (rel) => rel.source === source,
  );

  if (configs.length === 0) return null;

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5 text-xs">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Звʼязки CRM
      </p>
      <div className="space-y-1.5">
        {configs.map((rel) => (
          <div
            key={rel.id}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-1.5"
          >
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-slate-700">
                {rel.source} → {rel.target}
              </p>
              <p className="text-[10px] text-slate-500">
                {rel.display === "selector"
                  ? "Вибір з пошуком або створення нового."
                  : rel.display === "badge"
                  ? "Показ у вигляді бейджів над карткою."
                  : "Показ у блоці деталей."}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-100"
            >
              Налаштувати
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

