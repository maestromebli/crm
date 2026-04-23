"use client";

import { MoreHorizontal } from "lucide-react";
import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type {
  DealHealthStatus,
  DealViewRole,
} from "../../features/deal-workspace/deal-view-selectors";
import { DealHealthBadge } from "./DealHealthBadge";
import {
  evaluateCloseOrderGate,
  evaluateReadyForHandoffGate,
  evaluateReleaseToProductionGate,
} from "../../lib/enver/order-execution-policy";

type Props = {
  data: DealWorkspacePayload;
  стан: DealHealthStatus;
  onTab: (tab: DealWorkspaceTabId) => void;
  viewRole: DealViewRole;
  canSwitchRole: boolean;
  onRoleChange: (role: DealViewRole) => void;
  progressLabel: string;
  focusLabel: string;
};

export function DealCommandHeader({
  data,
  стан,
  onTab,
  viewRole,
  canSwitchRole,
  onRoleChange,
  progressLabel,
  focusLabel,
}: Props) {
  const hasHandoffFiles =
    data.handoff.manifest.selectedAttachmentIds.length > 0 ||
    data.handoff.manifest.selectedFileAssetIds.length > 0;
  const gateReadyForHandoff = evaluateReadyForHandoffGate({
    contractSigned: data.contract?.status === "FULLY_SIGNED",
    hasExecutionSpec: data.enverExecution.projectSpec.currentVersionApprovedForExecution,
    hasRequiredHandoffFiles: hasHandoffFiles,
  });
  const gateReleaseToProduction = evaluateReleaseToProductionGate({
    handoffAccepted: data.handoff.status === "ACCEPTED",
    handoffChecklistCompleted: data.enverExecution.handoffChecklist.complete,
    bomApproved: data.meta.executionControl?.bomApproved === true,
    criticalMaterialsReady: data.meta.executionControl?.criticalMaterialsReady === true,
  });
  const gateCloseOrder = evaluateCloseOrderGate({
    deliveryAccepted: data.meta.executionControl?.deliveryAccepted === true,
    financeActualsPosted: data.meta.executionControl?.financeActualsPosted === true,
    productionDone: data.meta.executionControl?.productionOrderDone === true,
  });

  return (
    <header className="rounded-2xl border border-[var(--enver-border)] bg-[var(--enver-card)]/95 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-base font-semibold text-[var(--enver-text)] md:text-lg">
            {data.deal.title}
          </h1>
          <p className="truncate text-xs text-[var(--enver-text-muted)]">
            {data.deal.number ? `№ ${data.deal.number} · ` : ""}
            {data.client.name} · {data.stage.name} · {data.owner.name ?? data.owner.email}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[10px]">
            <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5 font-medium text-[var(--enver-text-muted)]">
              Сума: {data.deal.value?.toLocaleString("uk-UA") ?? "—"} {data.deal.currency ?? ""}
            </span>
            <DealHealthBadge стан={стан} />
            <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5 text-[var(--enver-text-muted)]">
              {стан.reasonLabel}
            </span>
            <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5 text-[var(--enver-text-muted)]">
              {progressLabel}
            </span>
            <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5 text-[var(--enver-text-muted)]">
              Оновлено:{" "}
              {new Date(data.deal.updatedAt).toLocaleString("uk-UA", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          </div>
          <p className="truncate text-[11px] text-[var(--enver-text-muted)]">
            Фокус етапу: {focusLabel}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5 text-[10px]">
            <button
              type="button"
              onClick={() => onTab("handoff")}
              className={`rounded-full border px-2 py-0.5 font-medium ${
                gateReadyForHandoff.length === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
              title={
                gateReadyForHandoff.length === 0
                  ? "Гейт ready_for_handoff пройдено"
                  : gateReadyForHandoff[0].message
              }
            >
              RH {gateReadyForHandoff.length === 0 ? "OK" : "BLOCKED"}
            </button>
            <button
              type="button"
              onClick={() => onTab("production")}
              className={`rounded-full border px-2 py-0.5 font-medium ${
                gateReleaseToProduction.length === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
              title={
                gateReleaseToProduction.length === 0
                  ? "Гейт release_to_production пройдено"
                  : gateReleaseToProduction[0].message
              }
            >
              RTP {gateReleaseToProduction.length === 0 ? "OK" : "BLOCKED"}
            </button>
            <button
              type="button"
              onClick={() => onTab("finance")}
              className={`rounded-full border px-2 py-0.5 font-medium ${
                gateCloseOrder.length === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-rose-200 bg-rose-50 text-rose-800"
              }`}
              title={
                gateCloseOrder.length === 0
                  ? "Гейт close_order пройдено"
                  : gateCloseOrder[0].message
              }
            >
              CO {gateCloseOrder.length === 0 ? "OK" : "BLOCKED"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canSwitchRole ? (
            <label className="text-[11px] text-[var(--enver-text-muted)]">
              <span className="sr-only">Режим ролі</span>
              <select
                value={viewRole}
                onChange={(e) => onRoleChange(e.target.value as DealViewRole)}
                className="rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2 text-[11px]"
              >
                <option value="admin">Режим адміністратора</option>
                <option value="manager">Режим менеджера</option>
                <option value="constructor">Режим конструктора</option>
                <option value="production">Режим виробництва</option>
              </select>
            </label>
          ) : null}
          <details className="relative">
            <summary className="list-none rounded-xl border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2.5 py-2 text-[var(--enver-text-muted)] hover:bg-[var(--enver-hover)]">
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[var(--enver-border)] bg-[var(--enver-card)] p-1.5 shadow-lg">
              <button
                type="button"
                onClick={() => onTab("messages")}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
              >
                Комунікація
              </button>
              <button
                type="button"
                onClick={() => onTab("tasks")}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
              >
                Задачі
              </button>
              <button
                type="button"
                onClick={() => onTab("activity")}
                className="w-full rounded-lg px-2 py-1.5 text-left text-xs text-[var(--enver-text)] hover:bg-[var(--enver-hover)]"
              >
                Журнал
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
