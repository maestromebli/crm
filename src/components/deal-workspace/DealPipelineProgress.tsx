"use client";

import { useMemo, useState } from "react";
import { patchWorkspaceMetaByDealId } from "../../features/deal-workspace/use-deal-mutation-actions";
import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";
import { cn } from "../../lib/utils";
import type { DealPipelineStepState } from "../../features/deal-workspace/deal-view-selectors";

type Props = {
  steps: DealPipelineStepState[];
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
};

export function DealPipelineProgress({ steps, data, onTab }: Props) {
  const initial = useMemo(
    () => steps.find((step) => step.status === "current")?.id ?? steps[0]?.id ?? "qualification",
    [steps],
  );
  const [selectedStepId, setSelectedStepId] = useState(initial);
  const [nextStepLabel, setNextStepLabel] = useState(data.meta.nextStepLabel ?? "");
  const [nextActionAt, setNextActionAt] = useState(
    data.meta.nextActionAt
      ? new Date(data.meta.nextActionAt).toISOString().slice(0, 16)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const selectedStep = steps.find((step) => step.id === selectedStepId) ?? steps[0];
  const selectedTab = selectedStep?.relatedTab ?? "overview";

  const saveAndNavigate = async () => {
    setSaving(true);
    setStatusText(null);
    try {
      await patchWorkspaceMetaByDealId(data.deal.id, {
        nextStepLabel: nextStepLabel.trim() || null,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
      });
      onTab(selectedTab);
      setStatusText("План дії збережено. Відкриваю форму етапу.");
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Не вдалося зберегти план.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] px-3 py-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Pipeline progress
      </h3>
      <div className="grid gap-2 md:grid-cols-8">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setSelectedStepId(step.id)}
            className={cn(
              "rounded-xl border px-2 py-2 text-center transition",
              step.status === "done" && "border-emerald-200 bg-emerald-50",
              step.status === "current" && "border-[var(--enver-accent)] bg-[var(--enver-accent-soft)]",
              step.status === "blocked" && "border-rose-200 bg-rose-50",
              step.status === "locked" && "border-amber-200 bg-amber-50",
              selectedStepId === step.id && "ring-2 ring-[var(--enver-accent-ring)]",
            )}
          >
            <p className="text-[11px] font-semibold text-[var(--enver-text)]">{step.label}</p>
            {(step.status === "blocked" || step.status === "locked") && step.reason ? (
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  step.status === "blocked" ? "text-rose-900" : "text-amber-900",
                )}
              >
                {step.reason}
              </p>
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] p-3">
        <p className="text-[11px] font-semibold text-[var(--enver-text)]">
          Форма етапу: {selectedStep?.label ?? "—"}
        </p>
        <p className="mt-1 text-[11px] text-[var(--enver-text-muted)]">
          Оновіть план і перейдіть у робочий модуль етапу.
        </p>
        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_220px_auto]">
          <input
            value={nextStepLabel}
            onChange={(event) => setNextStepLabel(event.target.value)}
            placeholder="Конкретна дія для цього етапу"
            className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-2 text-xs text-[var(--enver-text)]"
          />
          <input
            type="datetime-local"
            value={nextActionAt}
            onChange={(event) => setNextActionAt(event.target.value)}
            className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-2 text-xs text-[var(--enver-text)]"
          />
          <button
            type="button"
            onClick={() => void saveAndNavigate()}
            disabled={saving}
            className="rounded-lg bg-[var(--enver-accent)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Збереження…" : "Зберегти і перейти"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTab(selectedTab)}
            className="rounded-lg border border-[var(--enver-border)] bg-[var(--enver-card)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--enver-text)]"
          >
            {selectedStep?.availableAction ?? "Відкрити модуль етапу"}
          </button>
          {statusText ? (
            <p className="text-[11px] text-[var(--enver-text-muted)]">{statusText}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
