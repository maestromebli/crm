"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Shield, Sparkles } from "lucide-react";
import { postJson } from "@/lib/api/patch-json";
import { parseJsonResponse } from "@/lib/http/parse-json-response";
import { cn } from "@/lib/utils";
import type { AiV2ContextName } from "../core/types";

type Props = {
  context: AiV2ContextName;
  leadId?: string;
  dealId?: string;
  className?: string;
};

type InsightResponse = {
  context: {
    title: string;
    flags: {
      overdueTasks: number;
      pendingPayments: number;
      missingFiles: number;
      missingDataCount: number;
      slaBreached: boolean;
      slaOverdueHours: number;
      openConstructorQuestions: number;
    };
    timelineFacts: string[];
  };
  decision: {
    summary: string;
    riskScore: number;
    healthScore: number;
    blockers: string[];
    riskReasons: string[];
    nextBestAction: string;
    followUpUrgency: "low" | "medium" | "high";
    readinessToNextStage: "not_ready" | "attention" | "ready";
  };
  plannedActions: { type: string; title: string; lowRisk: boolean }[];
  executedActions: { type: string; title: string }[];
  skippedDuplicateActions: { type: string; title: string }[];
  memory: {
    keyFacts: string[];
    unresolvedQuestions: string[];
    freshness: "fresh" | "stale";
  };
};

type AuditItem = {
  id: string;
  createdAt: string;
  model: string | null;
  user: { id: string; name: string | null; email: string | null } | null;
  riskScore: number | null;
  plannedActions: string[];
  executedActions: string[];
  blockers: string[];
};

const contextTitle: Record<AiV2ContextName, string> = {
  lead: "AI V2 Smart Panel (Lead)",
  deal: "AI V2 Smart Panel (Deal)",
  dashboard: "AI V2 Dashboard Intelligence",
  finance: "AI V2 Finance Guard",
  production: "AI V2 Production Readiness",
  procurement: "AI V2 Procurement Control",
};

function formatActionType(value: string): string {
  switch (value) {
    case "create_task":
      return "Створення задачі";
    case "create_reminder":
      return "Нагадування";
    case "escalate_team_lead":
      return "Ескалація Team Lead";
    default:
      return value;
  }
}

export function AiV2InsightCard({ context, leadId, dealId, className }: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<InsightResponse | null>(null);
  const [auditItems, setAuditItems] = useState<AuditItem[]>([]);

  const runInsight = useCallback(
    async (applyLowRiskActions: boolean) => {
      setError(null);
      if (applyLowRiskActions) setApplying(true);
      else setLoading(true);
      try {
        const data = await postJson<InsightResponse | { error?: string }>(
          "/api/ai-v2/insights",
          {
            context,
            leadId,
            dealId,
            applyLowRiskActions,
          },
        );
        if (!("decision" in data)) {
          throw new Error("Некоректна AI V2 відповідь");
        }
        setPayload(data);
        await loadAudit();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Помилка AI V2");
      } finally {
        setLoading(false);
        setApplying(false);
      }
    },
    [context, leadId, dealId],
  );

  const loadAudit = useCallback(async () => {
    try {
      const q = new URLSearchParams({ context, limit: "6" });
      if (leadId) q.set("leadId", leadId);
      if (dealId) q.set("dealId", dealId);
      const res = await fetch(`/api/ai-v2/audit?${q.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        setAuditItems([]);
        return;
      }
      const data = await parseJsonResponse<{ items?: AuditItem[]; error?: string }>(res, {
        serviceLabel: "AI V2",
      });
      setAuditItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setAuditItems([]);
    }
  }, [context, leadId, dealId]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const badgeTone = useMemo(() => {
    const score = payload?.decision.riskScore ?? 0;
    if (score >= 70) return "text-rose-700 bg-rose-50 border-rose-200";
    if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }, [payload?.decision.riskScore]);

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-4 shadow-[var(--enver-shadow)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white">
            {loading || applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              {contextTitle[context]}
            </h3>
            <p className="text-[11px] text-[var(--enver-text-muted)]">
              Context-aware рішення + low-risk automations + audit trail
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void runInsight(false)}
            disabled={loading || applying}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-medium text-indigo-900 disabled:opacity-60"
          >
            Оновити AI V2
          </button>
          <button
            type="button"
            onClick={() => void runInsight(true)}
            disabled={loading || applying}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-900 disabled:opacity-60"
          >
            <Shield className="h-3.5 w-3.5" />
            Apply low-risk
          </button>
        </div>
      </div>

      {payload ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", badgeTone)}>
                Risk: {payload.decision.riskScore}/100
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Health: {payload.decision.healthScore}/100
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Readiness: {payload.decision.readinessToNextStage}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                Urgency: {payload.decision.followUpUrgency}
              </span>
              {payload.context.flags.slaBreached ? (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700">
                  SLA breach +{payload.context.flags.slaOverdueHours}h
                </span>
              ) : null}
              {payload.context.flags.missingDataCount > 0 ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Missing data: {payload.context.flags.missingDataCount}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-[var(--enver-text)]">{payload.decision.summary}</p>
            <p className="mt-1 text-[12px] text-[var(--enver-text-muted)]">
              Next best action: {payload.decision.nextBestAction}
            </p>
            {payload.decision.riskReasons.length > 0 ? (
              <ul className="mt-2 space-y-1 text-[11px] text-slate-600">
                {payload.decision.riskReasons.slice(0, 3).map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {payload.decision.blockers.length > 0 ? (
            <ul className="space-y-1.5">
              {payload.decision.blockers.map((b, i) => (
                <li
                  key={`${b}-${i}`}
                  className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-2 text-[12px] text-rose-900"
                >
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[12px] text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Критичних блокерів не виявлено.
            </p>
          )}

          {payload.plannedActions.length > 0 ? (
            <div className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
                План дій AI V2
              </p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-[var(--enver-text)]">
                {payload.plannedActions.map((a, i) => (
                  <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-2">
                    <span>{a.title}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                      {formatActionType(a.type)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {payload.skippedDuplicateActions.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                Пропущено як дублікат
              </p>
              <ul className="mt-2 space-y-1.5 text-[12px] text-amber-900">
                {payload.skippedDuplicateActions.map((a, i) => (
                  <li key={`${a.type}-${i}`} className="flex items-center justify-between gap-2">
                    <span>{a.title}</span>
                    <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] text-amber-700">
                      {formatActionType(a.type)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 border-t border-[var(--enver-border)] pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
          Audit trail
        </p>
        {auditItems.length === 0 ? (
          <p className="mt-1 text-[12px] text-[var(--enver-text-muted)]">
            Ще немає запусків AI V2 для цього контексту.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {auditItems.slice(0, 5).map((a) => (
              <li key={a.id} className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--enver-muted)]">
                  <span>{new Date(a.createdAt).toLocaleString("uk-UA")}</span>
                  <span>Risk: {a.riskScore ?? "—"}</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--enver-text)]">
                  Planned: {a.plannedActions.map(formatActionType).join(", ") || "—"}
                </p>
                <p className="text-[11px] text-emerald-700">
                  Executed: {a.executedActions.map(formatActionType).join(", ") || "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg bg-rose-50 px-2.5 py-2 text-[12px] text-rose-900">{error}</p>
      ) : null}
    </section>
  );
}
