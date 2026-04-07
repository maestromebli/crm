"use client";

import { useEffect, useState } from "react";
import { Loader2, Sun } from "lucide-react";
import { parseJsonResponse } from "../../lib/http/parse-json-response";
import type { AiOperationSuccess } from "../../features/ai/core/types";
import { AIStructuredResult } from "../../features/ai/ui/AIStructuredResult";

type Props = {
  fallback: string;
  /** JSON з дашборду для операційного brief (рекомендовано на головній). */
  dashboardBriefContext?: string;
};

export function DashboardAiSummary({
  fallback,
  dashboardBriefContext,
}: Props) {
  const [text, setText] = useState(fallback);
  const [loading, setLoading] = useState(false);
  const [structured, setStructured] = useState<AiOperationSuccess | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        if (dashboardBriefContext?.trim()) {
          const res = await fetch("/api/ai/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              operation: "dashboard_brief",
              dashboardContext: dashboardBriefContext,
            }),
          });
          const data = await parseJsonResponse<
            AiOperationSuccess | { error?: string; ok?: false }
          >(res, { serviceLabel: "AI" });
          if (!res.ok || !("ok" in data) || !data.ok) {
            setStructured(null);
            setText(fallback);
            return;
          }
          setStructured(data);
          setConfigured(data.configured);
          setText("");
          return;
        }

        const res = await fetch("/api/ai/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "dashboard",
            context:
              "Онбордингова CRM для меблів під замовлення. Потрібен короткий огляд дня по лідах, угодах та handoff.",
          }),
        });
        const data = (await res.json()) as { text?: string };
        if (data.text) setText(data.text);
      } catch {
        setStructured(null);
        setText(fallback);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [dashboardBriefContext, fallback]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sun className="h-4 w-4" strokeWidth={1.75} />
          )}
        </div>
        {structured?.operation === "dashboard_brief" ? (
          <div className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700">
            {!configured ? (
              <p className="mb-2 text-[10px] text-amber-800">
                AI_API_KEY не налаштовано — показано евристичний огляд.
              </p>
            ) : null}
            <AIStructuredResult payload={structured} />
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-700">
            {loading ? (
              <span className="text-slate-500">Формуємо стислий огляд дня…</span>
            ) : (
              text
            )}
          </p>
        )}
      </div>
    </div>
  );
}
