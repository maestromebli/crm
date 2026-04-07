"use client";

import { useCallback, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { parseJsonResponse } from "../../../lib/http/parse-json-response";
import { cn } from "../../../lib/utils";
import type { AiOperationSuccess } from "../core/types";
import { AIStructuredResult } from "./AIStructuredResult";

type Props = {
  leadId: string;
  className?: string;
};

export function LeadAiOperationsPanel({ leadId, className }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState<AiOperationSuccess | null>(null);
  const [tone, setTone] = useState<"neutral" | "friendly" | "formal">(
    "neutral",
  );

  const run = useCallback(
    async (operation: AiOperationSuccess["operation"]) => {
      setErr(null);
      setLoading(operation);
      try {
        const r = await fetch("/api/ai/operations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation,
            leadId,
            ...(operation === "lead_follow_up" ? { tone } : {}),
          }),
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
    [leadId, tone],
  );

  const btnClass =
    "rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--enver-text)] shadow-[var(--enver-shadow)] transition duration-200 hover:border-[var(--enver-border-strong)] disabled:opacity-50";

  return (
    <section
      className={cn(
        "rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)]",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#2563EB] text-white">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="text-[12px] font-medium uppercase tracking-wide text-[var(--enver-muted)]">
              Операційний ШІ
            </h3>
            <p className="mt-0.5 text-[12px] leading-snug text-[var(--enver-text-muted)]">
              Швидкі дії на базі даних картки (не чат). Текст можна копіювати —
              зміни в CRM лише вручну.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("lead_summary")}
            >
              Підсумок ліда
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("lead_next_step")}
            >
              Наступний крок
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("lead_risk_explain")}
            >
              Пояснити ризики
            </button>
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("proposal_intro")}
            >
              Вступ до КП
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--enver-muted)]">Follow-up:</span>
            <select
              value={tone}
              onChange={(e) =>
                setTone(e.target.value as "neutral" | "friendly" | "formal")
              }
              className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] px-2 py-1 text-[12px] text-[var(--enver-text)]"
            >
              <option value="neutral">Нейтральний</option>
              <option value="friendly">Теплий</option>
              <option value="formal">Офіційний</option>
            </select>
            <button
              type="button"
              className={btnClass}
              disabled={loading !== null}
              onClick={() => void run("lead_follow_up")}
            >
              Згенерувати follow-up
            </button>
          </div>

          {err ? (
            <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-[11px] text-rose-900">
              {err}
            </p>
          ) : null}

          {last ? (
            <div className="border-t border-[var(--enver-border)] pt-3">
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
