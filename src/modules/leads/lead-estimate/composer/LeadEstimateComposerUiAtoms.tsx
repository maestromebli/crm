"use client";

import type { ReactNode } from "react";
import { cn } from "../../../../lib/utils";
import {
  ESTIMATE_CATEGORY_LABELS,
  ESTIMATE_CATEGORY_KEYS,
  type EstimateCategoryKey,
} from "../../../../lib/estimates/estimate-categories";
import type { MaterialSearchHit } from "./lead-estimate-composer-types";

export function formatMoney(value: number, currency = "UAH") {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      {children}
    </label>
  );
}

export function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "green" | "blue" | "amber" | "rose" | "zinc";
}) {
  const styles = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    amber: "bg-amber-100 text-amber-800 border-amber-200",
    rose: "bg-rose-100 text-rose-800 border-rose-200",
    zinc: "bg-zinc-100 text-zinc-700 border-zinc-200",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        styles,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          <span className="rounded-xl bg-zinc-100 p-2 text-zinc-700">{icon}</span>
          {title}
        </div>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function CategorySelect({
  value,
  onChange,
  disabled,
}: {
  value: EstimateCategoryKey;
  onChange: (k: EstimateCategoryKey) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as EstimateCategoryKey)}
      className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition focus:border-zinc-400 disabled:opacity-60"
    >
      {ESTIMATE_CATEGORY_KEYS.map((k) => (
        <option key={k} value={k}>
          {ESTIMATE_CATEGORY_LABELS[k]}
        </option>
      ))}
    </select>
  );
}

export function mapCatalogHitToMaterialHit(h: {
  id: string;
  label: string;
  hint?: string;
  unitPrice?: number;
  providerKey?: string;
}): MaterialSearchHit {
  return {
    supplier: h.providerKey ?? "catalog",
    materialId: h.id,
    code: h.hint?.slice(0, 32) ?? h.id,
    name: h.label,
    price: h.unitPrice ?? 0,
    currency: "UAH",
  };
}
