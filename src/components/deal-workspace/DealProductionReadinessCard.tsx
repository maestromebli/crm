"use client";

import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type {
  DealProductionReadiness,
  DealSmartInsight,
  DealWarning,
} from "../../features/deal-workspace/deal-view-selectors";
import {
  evaluateCloseOrderGate,
  evaluateReadyForHandoffGate,
  evaluateReleaseToProductionGate,
} from "../../lib/enver/order-execution-policy";

export function DealProductionReadinessCard({
  readiness,
  insights,
  warnings,
  data,
  onTab,
}: {
  readiness: DealProductionReadiness;
  insights: DealSmartInsight[];
  warnings: DealWarning[];
  data: DealWorkspacePayload;
  onTab: (tab: DealWorkspaceTabId) => void;
}) {
  const compactInsights = insights.slice(0, 3);
  const hasHandoffFiles =
    data.handoff.manifest.selectedAttachmentIds.length > 0 ||
    data.handoff.manifest.selectedFileAssetIds.length > 0;
  const readyForHandoffBlockers = evaluateReadyForHandoffGate({
    contractSigned: data.contract?.status === "FULLY_SIGNED",
    hasExecutionSpec: data.enverExecution.projectSpec.currentVersionApprovedForExecution,
    hasRequiredHandoffFiles: hasHandoffFiles,
  });
  const releaseToProductionBlockers = evaluateReleaseToProductionGate({
    handoffAccepted: data.handoff.status === "ACCEPTED",
    handoffChecklistCompleted: data.enverExecution.handoffChecklist.complete,
    bomApproved: data.meta.executionControl?.bomApproved === true,
    criticalMaterialsReady: data.meta.executionControl?.criticalMaterialsReady === true,
  });
  const closeOrderBlockers = evaluateCloseOrderGate({
    deliveryAccepted: data.meta.executionControl?.deliveryAccepted === true,
    financeActualsPosted: data.meta.executionControl?.financeActualsPosted === true,
    productionDone: data.meta.executionControl?.productionOrderDone === true,
  });
  return (
    <section className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
        Готовність до виробництва
      </p>
      <p className="mt-1 text-xs text-[var(--enver-text-muted)]">
        {readiness.label}:{" "}
        <span className="font-medium text-[var(--enver-text)]">
          {readiness.done}/{readiness.total}
        </span>
      </p>
      <button
        type="button"
        onClick={() => onTab("handoff")}
        className="mt-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--enver-text)]"
      >
        Відкрити передачу
      </button>
      <details className="mt-3 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] p-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--enver-text)]">
          Smart insights
        </summary>
        <ul className="mt-2 space-y-1 text-[11px] text-[var(--enver-text-muted)]">
          {compactInsights.map((item) => (
            <li key={item.id}>- {item.title}</li>
          ))}
          {warnings.slice(0, 1).map((item) => (
            <li key={item.id}>- Рекомендація: {item.title}</li>
          ))}
        </ul>
      </details>
      <details className="mt-2 rounded-lg border border-[var(--enver-border)] bg-[var(--enver-surface)] p-2">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--enver-text)]">
          ENVER Gates
        </summary>
        <div className="mt-2 space-y-2 text-[11px]">
          <div>
            <p className="font-medium text-[var(--enver-text)]">
              ready_for_handoff:{" "}
              <span
                className={
                  readyForHandoffBlockers.length === 0
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {readyForHandoffBlockers.length === 0 ? "OK" : "BLOCKED"}
              </span>
            </p>
            {readyForHandoffBlockers.length > 0 ? (
              <ul className="mt-1 space-y-1 text-[var(--enver-text-muted)]">
                {readyForHandoffBlockers.slice(0, 2).map((b) => (
                  <li key={`rh-${b.code}`}>- {b.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <p className="font-medium text-[var(--enver-text)]">
              release_to_production:{" "}
              <span
                className={
                  releaseToProductionBlockers.length === 0
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {releaseToProductionBlockers.length === 0 ? "OK" : "BLOCKED"}
              </span>
            </p>
            {releaseToProductionBlockers.length > 0 ? (
              <ul className="mt-1 space-y-1 text-[var(--enver-text-muted)]">
                {releaseToProductionBlockers.slice(0, 2).map((b) => (
                  <li key={`rp-${b.code}`}>- {b.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <p className="font-medium text-[var(--enver-text)]">
              close_order:{" "}
              <span
                className={
                  closeOrderBlockers.length === 0
                    ? "text-emerald-700"
                    : "text-rose-700"
                }
              >
                {closeOrderBlockers.length === 0 ? "OK" : "BLOCKED"}
              </span>
            </p>
            {closeOrderBlockers.length > 0 ? (
              <ul className="mt-1 space-y-1 text-[var(--enver-text-muted)]">
                {closeOrderBlockers.slice(0, 2).map((b) => (
                  <li key={`co-${b.code}`}>- {b.message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </details>
    </section>
  );
}
