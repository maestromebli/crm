"use client";

import { MoreHorizontal } from "lucide-react";
import type { DealWorkspacePayload, DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type {
  DealHealthStatus,
  DealViewRole,
} from "../../features/deal-workspace/deal-view-selectors";
import { DealHealthBadge } from "./DealHealthBadge";

type Props = {
  data: DealWorkspacePayload;
  health: DealHealthStatus;
  onTab: (tab: DealWorkspaceTabId) => void;
  viewRole: DealViewRole;
  canSwitchRole: boolean;
  onRoleChange: (role: DealViewRole) => void;
  progressLabel: string;
  focusLabel: string;
};

export function DealCommandHeader({
  data,
  health,
  onTab,
  viewRole,
  canSwitchRole,
  onRoleChange,
  progressLabel,
  focusLabel,
}: Props) {
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
            <DealHealthBadge health={health} />
            <span className="rounded-full border border-[var(--enver-border)] bg-[var(--enver-surface)] px-2 py-0.5 text-[var(--enver-text-muted)]">
              {health.reasonLabel}
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
