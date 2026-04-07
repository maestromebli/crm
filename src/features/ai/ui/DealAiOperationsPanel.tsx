"use client";

import { useCallback, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { parseJsonResponse } from "../../../lib/http/parse-json-response";
import { cn } from "../../../lib/utils";
import type { AiOperationSuccess } from "../core/types";
import { AIStructuredResult } from "./AIStructuredResult";

type Props = {
  dealId: string;
  className?: string;
};

export function DealAiOperationsPanel({ dealId, className }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<AiOperationSuccess | null>(null);

  const run = useCallback(
    async (operation: "deal_summary" | "deal_readiness") => {
      setErr(null);
      setLoading(operation);
      try {
        const r = await fetch("/api/ai/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation, dealId }),
        });
        const j = await parseJsonResponse<
          AiOperationSuccess | { error?: string }
        >(r);
        if (!r.ok) {
          throw new Error(
            "error" in j && j.error ? j.error : "Помилка запиту",
          );
        }
        if (!("ok" in j) || !j.ok) {
          throw new Error("Некоректна відповідь сервера");
        }
        setLast(j);
      } catch (e) {
        setLast(null);
        setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        setLoading(null);
      }
    },
    [dealId],
  );

  const btnClass =
    "rounded-lg border border-sky-200 bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] font-medium text-sky-950 shadow-sm hover:bg-sky-50 disabled:opacity-50";

  return (
    <section
      className={cn(
        "rounded-2xl border border-sky-200/80 bg-gradient-to-b from-white to-sky-50/50 p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-600/25">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-sky-950">
              ШІ угоди
            </h3>
            <p className="mt-0.5 text-[11px] leading-snug text-sky-900/85">
              Підсумок та готовність на основі робочого місця угоди. Без
              автоматичних змін у БД.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("deal_summary")}
            >
              Підсумок угоди
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("deal_readiness")}
            >
              Готовність і блокери
            </button>
          </div>
          {err ? (
            <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] text-rose-900">
              {err}
            </p>
          ) : null}
          {last ? (
            <div className="border-t border-sky-100 pt-3">
              {!last.configured ? (
                <p className="mb-2 text-[10px] text-amber-900">
                  AI_API_KEY не налаштовано — показано евристичний fallback.
                </p>
              ) : null}
              <AIStructuredResult payload={last} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
