"use client";

import type { ConstructorChecklistItem, ConstructorTask, ConstructorWorkspace } from "../constructor-hub.types";
import { ConstructorZoneProgressList } from "./ConstructorZoneProgressList";

type Props = {
  stages: ConstructorWorkspace["stages"];
  checklist: ConstructorChecklistItem[];
  zoneProgress: ConstructorWorkspace["zoneProgress"];
  tasks: ConstructorTask[];
};

export function ConstructorLeftPanel({ stages, checklist, zoneProgress, tasks }: Props) {
  return (
    <aside className="space-y-3">
      <Card title="Етапи проєкту">
        <ul className="space-y-2 text-xs">
          {stages.map((stage) => (
            <li key={stage.id} className="flex items-center justify-between">
              <span className="text-slate-700">{stage.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  stage.state === "DONE"
                    ? "bg-emerald-100 text-emerald-800"
                    : stage.state === "ACTIVE"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {stage.state === "DONE" ? "Готово" : stage.state === "ACTIVE" ? "Зараз" : "Далі"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Чеклист конструктора">
        <ul className="space-y-2 text-xs">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${item.done ? "bg-emerald-500" : "bg-slate-300"}`} />
              <span className={item.done ? "text-slate-500 line-through" : "text-slate-700"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Прогрес по зонах">
        <ConstructorZoneProgressList zones={zoneProgress} />
      </Card>

      <Card title="Особисті задачі">
        <ul className="space-y-2 text-xs">
          {tasks.length === 0 ? <li className="text-slate-500">Особистих задач поки немає.</li> : null}
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="font-medium text-slate-800">{task.title}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                {task.dueAt ? `Дедлайн: ${new Date(task.dueAt).toLocaleString("uk-UA")}` : "Без дедлайну"}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Швидка навігація">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {[
            ["#tech-spec", "ТЗ"],
            ["#questions", "Питання"],
            ["#files", "Файли"],
            ["#versions", "Версії"],
            ["#approval", "Перевірка"],
            ["#history", "Історія"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50">
              {label}
            </a>
          ))}
        </div>
      </Card>
    </aside>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}
