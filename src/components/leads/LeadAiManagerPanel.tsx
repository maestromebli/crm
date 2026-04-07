"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useLeadMutationActions } from "../../features/leads/use-lead-mutation-actions";
import type { LeadDetailRow } from "../../features/leads/queries";
import { parseJsonResponse } from "../../lib/http/parse-json-response";
import { cn } from "../../lib/utils";

export type AiInsightResponse = {
  configured: boolean;
  summary: string;
  managerTips: string[];
  recommendedStageId: string | null;
  recommendedStageName: string | null;
  currentStageId: string;
  currentStageName: string;
  reason: string;
  confidence: string;
  appliedStage: boolean;
  autoApplyBlocked?: string;
  error?: string;
};

type Props = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  /** Трохи компактніший варіант для огляду */
  compact?: boolean;
};

const CONF_UA: Record<string, string> = {
  low: "низька",
  medium: "середня",
  high: "висока",
};

export function LeadAiManagerPanel({
  lead,
  canUpdateLead,
  compact,
}: Props) {
  const router = useRouter();
  const leadActions = useLeadMutationActions(lead.id);
  const [loading, setLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [insight, setInsight] = useState<AiInsightResponse | null>(null);
  const [autoApplyStage, setAutoApplyStage] = useState(false);

  const runInsight = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await fetch(`/api/leads/${lead.id}/ai-insight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApplyStage }),
      });
      const j = await parseJsonResponse<AiInsightResponse & { error?: string }>(
        r,
      );
      if (!r.ok) {
        throw new Error(j.error ?? "Помилка аналізу");
      }
      setInsight(j);
      if (j.appliedStage) {
        router.refresh();
      }
    } catch (e) {
      setInsight(null);
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setLoading(false);
    }
  }, [lead.id, autoApplyStage, router]);

  const applyRecommendedStage = useCallback(async () => {
    if (!insight?.recommendedStageId || !canUpdateLead) return;
    if (insight.recommendedStageId === lead.stageId) return;
    setApplyLoading(true);
    setErr(null);
    try {
      await leadActions.updateStage(insight.recommendedStageId);
      setInsight((prev) =>
        prev
          ? {
              ...prev,
              currentStageId: insight.recommendedStageId!,
              currentStageName:
                insight.recommendedStageName ?? prev.currentStageName,
              appliedStage: true,
            }
          : prev,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setApplyLoading(false);
    }
  }, [canUpdateLead, insight, lead.stageId, leadActions]);

  const wrap = cn(
    "rounded-2xl border border-violet-200/80 bg-gradient-to-b from-violet-50/90 to-white p-4 shadow-sm",
    compact ? "text-xs" : "text-sm",
  );

  const stageForCompare = insight?.appliedStage
    ? insight.currentStageId
    : lead.stageId;
  const showApplyBtn =
    Boolean(
      canUpdateLead &&
        insight?.recommendedStageId &&
        insight.recommendedStageId !== stageForCompare &&
        !insight.appliedStage,
    );

  return (
    <section className={wrap}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            className={cn(
              "font-semibold text-violet-950",
              compact ? "text-[11px] uppercase tracking-wide" : "text-sm",
            )}
          >
            ШІ для менеджера
          </h2>
          <p className="mt-1 text-[11px] leading-snug text-violet-900/80">
            Аналіз картки, поради та рекомендована стадія воронки. Стадію можна
            змінити вручну на огляді або застосувати рекомендацію ШІ.
          </p>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[11px] text-violet-900">
        <input
          type="checkbox"
          checked={autoApplyStage}
          onChange={(e) => setAutoApplyStage(e.target.checked)}
          disabled={loading || !canUpdateLead}
          className="rounded border-violet-300 text-violet-700 focus:ring-violet-500"
        />
        <span>
          Після аналізу <strong>автоматично</strong> перемістити лід на
          рекомендовану стадію (якщо ШІ запропонує зміну)
        </span>
      </label>

      <button
        type="button"
        disabled={loading}
        onClick={() => void runInsight()}
        className={cn(
          "mt-3 rounded-lg bg-violet-700 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-violet-800 disabled:opacity-50",
        )}
      >
        {loading ? "Аналіз…" : "Запустити аналіз ШІ"}
      </button>

      {err ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
          {err}
        </p>
      ) : null}

      {insight?.autoApplyBlocked ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {insight.autoApplyBlocked}
        </p>
      ) : null}

      {insight ? (
        <div className="mt-4 space-y-3 border-t border-violet-100 pt-4">
          {!insight.configured ? (
            <p className="text-[11px] text-violet-800">{insight.summary}</p>
          ) : (
            <>
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                  Підсумок
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-800">
                  {insight.summary}
                </p>
              </div>

              {insight.managerTips.length > 0 ? (
                <div>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                    Поради менеджеру
                  </h3>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                    {insight.managerTips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-lg bg-[var(--enver-card)]/80 px-3 py-2 text-[11px] text-slate-700 ring-1 ring-violet-100">
                <p>
                  <span className="text-slate-500">Поточна стадія:</span>{" "}
                  <strong>{insight.currentStageName}</strong>
                </p>
                {insight.recommendedStageId ? (
                  <p className="mt-1">
                    <span className="text-slate-500">Рекомендація ШІ:</span>{" "}
                    <strong>
                      {insight.recommendedStageName ?? insight.recommendedStageId}
                    </strong>
                  </p>
                ) : (
                  <p className="mt-1 text-slate-500">
                    ШІ радить залишити поточну стадію.
                  </p>
                )}
                {insight.reason ? (
                  <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-600">
                    {insight.reason}
                  </p>
                ) : null}
                <p className="mt-1 text-[10px] text-slate-500">
                  Впевненість:{" "}
                  {CONF_UA[insight.confidence] ?? insight.confidence}
                </p>
              </div>

              {insight.appliedStage ? (
                <p className="text-[11px] font-medium text-emerald-700">
                  Стадію оновлено за рекомендацією ШІ.
                </p>
              ) : null}

              {showApplyBtn ? (
                <button
                  type="button"
                  disabled={applyLoading}
                  onClick={() => void applyRecommendedStage()}
                  className="rounded-lg border border-violet-300 bg-[var(--enver-card)] px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-50 disabled:opacity-50"
                >
                  {applyLoading
                    ? "Застосовую…"
                    : `Застосувати стадію вручну: «${insight.recommendedStageName ?? "рекомендована"}»`}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
