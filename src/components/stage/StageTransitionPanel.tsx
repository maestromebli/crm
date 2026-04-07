"use client";

import { CHECKLIST_TEMPLATES } from "../../config/checklists";

type StageTransitionPanelProps = {
  checklistId?: string;
};

export function StageTransitionPanel({
  checklistId = "handoff-default",
}: StageTransitionPanelProps) {
  const checklist = CHECKLIST_TEMPLATES.find(
    (c) => c.id === checklistId,
  );

  if (!checklist) return null;

  return (
    <section className="space-y-2 rounded-2xl border border-slate-200 bg-[var(--enver-card)] px-3 py-2.5 text-xs">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Перевірка перед переходом
      </p>
      <p className="text-[11px] text-slate-600">
        Шаблон: {checklist.label}
      </p>
      <ul className="space-y-1">
        {checklist.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1"
          >
            <span className="text-[11px] text-slate-700">
              {item.label}
            </span>
            {item.required && (
              <span className="text-[10px] font-medium text-amber-700">
                required
              </span>
            )}
          </li>
        ))}
      </ul>
      {checklist.blocksTransition && (
        <p className="mt-1 text-[10px] text-rose-600">
          Перехід буде заблокований, доки всі обовʼязкові
          пункти не виконані.
        </p>
      )}
    </section>
  );
}

