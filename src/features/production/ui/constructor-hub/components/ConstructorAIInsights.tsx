"use client";

import { Sparkles } from "lucide-react";
import { AI_LEVEL_CLASS } from "../constructor-hub.labels";
import type { ConstructorAIAlert } from "../constructor-hub.types";
import { Button } from "@/components/ui/button";

export function ConstructorAIInsights({
  alerts,
  onRunCheck,
}: {
  alerts: ConstructorAIAlert[];
  onRunCheck: () => void;
}) {
  const risks = alerts.filter((item) => item.section === "RISKS");
  const check = alerts.filter((item) => item.section === "CHECK");
  const missing = alerts.filter((item) => item.section === "MISSING");
  const recs = alerts.filter((item) => item.section === "RECOMMENDATION");

  return (
    <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">AI-Помощник</h3>
        <Sparkles className="h-4 w-4 text-indigo-600" />
      </div>
      <div className="mt-3 space-y-3 text-xs">
        <AlertGroup title="Риски" alerts={risks} />
        <AlertGroup title="Что проверить" alerts={check} />
        <AlertGroup title="Что отсутствует" alerts={missing} />
        <AlertGroup title="Рекомендации перед отправкой" alerts={recs} />
      </div>
      <Button className="mt-3 w-full" onClick={onRunCheck}>
        Запустить AI-проверку
      </Button>
    </section>
  );
}

function AlertGroup({
  title,
  alerts,
}: {
  title: string;
  alerts: ConstructorAIAlert[];
}) {
  return (
    <div>
      <p className="mb-1 font-semibold text-slate-800">{title}</p>
      {alerts.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-500">Пока без сигналов.</p>
      ) : (
        <ul className="space-y-1">
          {alerts.map((alert) => (
            <li key={alert.id} className={`rounded-lg border px-2 py-1.5 ${AI_LEVEL_CLASS[alert.level]}`}>
              {alert.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
