"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import type {
  ConstructorWorkspaceState,
  DealProductionReadiness,
  DealViewRole,
  ProductionPackageStatus,
} from "../../features/deal-workspace/deal-view-selectors";

export type HandoffChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  ownerRole: DealViewRole;
  ctaLabel: string;
  onCta: () => void;
};

export function DealTransferHub({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

export function ProductionReadiness({
  readiness,
  onSubmit,
  submitDisabled,
  submitLabel,
}: {
  readiness: DealProductionReadiness;
  onSubmit: () => void;
  submitDisabled: boolean;
  submitLabel: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Production readiness
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">
        Готовність: {readiness.done}/{readiness.total} ({Math.round(readiness.ratio * 100)}%)
      </p>
      <p className="mt-1 text-xs text-slate-600">
        Статус: {readiness.isReady ? "ГОТОВО" : "НЕ ГОТОВО"}
      </p>
      {!readiness.isReady ? (
        <p className="mt-1 text-[11px] text-rose-700">
          Missing: {readiness.missingItems.slice(0, 3).join(", ")}
        </p>
      ) : null}
      <button
        type="button"
        disabled={submitDisabled}
        onClick={onSubmit}
        className="mt-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </section>
  );
}

export function HandoffChecklist({ items }: { items: HandoffChecklistItem[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Handoff checklist
      </p>
      <ul className="mt-2 space-y-1.5 text-xs">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span className={item.done ? "text-emerald-700" : "text-rose-700"}>
              {item.done ? "✅" : "❌"} {item.label}
            </span>
            <button
              type="button"
              onClick={item.onCta}
              className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700"
            >
              {item.ctaLabel}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ConstructorWorkspaceTabs({
  value,
  onChange,
}: {
  value: "technical" | "files" | "comments" | "versions";
  onChange: (tab: "technical" | "files" | "comments" | "versions") => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[
        ["technical", "Технічні дані"],
        ["files", "Файли"],
        ["comments", "Коментар"],
        ["versions", "Версії"],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id as "technical" | "files" | "comments" | "versions")}
          className={cn(
            "rounded-md border px-2 py-1 text-[11px]",
            value === id
              ? "border-slate-800 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-700",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ConstructorWorkspace({
  state,
  children,
}: {
  state: ConstructorWorkspaceState;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Constructor workspace
      </p>
      <p className="mt-1 text-[11px] text-slate-600">
        Tech: {state.technicalReady ? "ok" : "missing"} · Drawings:{" "}
        {state.drawingsReady ? "ok" : "missing"} · Files: {state.filesReady ? "ok" : "missing"}
      </p>
      {children}
    </section>
  );
}

export function ProductionPackage({ status }: { status: ProductionPackageStatus }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Production package
      </p>
      <p className="mt-1 text-xs text-slate-700">Статус: {status.status}</p>
      <p className="mt-1 text-xs text-slate-700">
        Файли: {status.filesCount} · Креслення: {status.drawingsCount}
      </p>
      <p className="mt-1 text-xs text-slate-700">
        ТЗ: {status.hasTechnicalAssignment ? "є" : "немає"} · Остання зміна: {status.lastChangeLabel}
      </p>
    </section>
  );
}

export function HandoffHistory({
  notes,
  historyLabel,
}: {
  notes: string;
  historyLabel: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Handoff history
      </p>
      <p className="mt-1 text-[11px] text-slate-600">{historyLabel}</p>
      <p className="mt-2 whitespace-pre-wrap text-xs text-slate-700">{notes || "Немає коментарів"}</p>
    </section>
  );
}

export function FinalActionArea({
  role,
  onAction,
  actionLabel,
  disabled,
}: {
  role: DealViewRole;
  onAction: () => void;
  actionLabel: string;
  disabled: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-900 p-3 text-white">
      <p className="text-[11px] uppercase tracking-wide text-slate-300">Final action area · {role}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </section>
  );
}
