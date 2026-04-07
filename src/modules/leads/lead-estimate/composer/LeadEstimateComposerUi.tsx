"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  FileText,
  GripVertical,
  History,
  Layers3,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { ESTIMATE_CATEGORY_LABELS } from "../../../../lib/estimates/estimate-categories";
import { cn } from "../../../../lib/utils";
import type {
  DiffResult,
  DraftItem,
  EstimateVersionModel,
  LeadMini,
  MaterialSearchHit,
  PageMode,
  VersionItem,
} from "./lead-estimate-composer-types";
import {
  CategorySelect,
  Field,
  formatMoney,
  SectionTitle,
  StatusChip,
} from "./LeadEstimateComposerUiAtoms";

export function PageHeader({
  lead,
  leadHref,
  currentVersion,
  selectedVersion,
  mode,
  onBackToView,
  onNewVersion,
  onCreateProposal,
}: {
  lead: LeadMini;
  leadHref: string;
  currentVersion: EstimateVersionModel;
  selectedVersion: EstimateVersionModel;
  mode: PageMode;
  onBackToView: () => void;
  onNewVersion: () => void;
  onCreateProposal: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Link
              href={leadHref}
              className="inline-flex items-center gap-1 rounded-xl px-2 py-1 hover:bg-zinc-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Лід
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="truncate">Смета</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              {lead.title}
            </h1>
            <StatusChip tone="blue">{lead.stage}</StatusChip>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            <span>{lead.customerName}</span>
            <span>•</span>
            <span>{lead.phone}</span>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700">
              Estimate
            </div>
            <StatusChip tone={selectedVersion.status === "current" ? "green" : "zinc"}>
              v{selectedVersion.versionNumber}{" "}
              {selectedVersion.status === "current" ? "Поточна" : "Архів"}
            </StatusChip>
            {mode !== "view" ? (
              <StatusChip tone="amber">
                {mode === "draft" ? "Чернетка" : "Порівняння"}
              </StatusChip>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {mode !== "view" ? (
              <button
                type="button"
                onClick={onBackToView}
                className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
              >
                До перегляду
              </button>
            ) : null}
            <button
              type="button"
              onClick={onCreateProposal}
              className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Створити КП
            </button>
            <button
              type="button"
              onClick={onNewVersion}
              className="rounded-2xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Нова версія з v{currentVersion.versionNumber}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DraftBanner({
  baseVersion,
  nextVersion,
  onDiscard,
  onPreview,
  onPublish,
  disabled,
}: {
  baseVersion: number;
  nextVersion: number;
  onDiscard: () => void;
  onPreview: () => void;
  onPublish: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-5 flex flex-col gap-4 rounded-[28px] border border-amber-200 bg-amber-50 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm font-semibold text-amber-900">
          Нова версія ще не створена
        </div>
        <div className="mt-1 text-sm text-amber-800">
          Чернетка на базі v{baseVersion}. Після публікації буде v{nextVersion}.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-2xl border border-amber-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Перегляд змін
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-2xl border border-amber-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Скасувати
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onPublish}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-medium text-white transition",
            disabled ? "cursor-not-allowed bg-zinc-300" : "bg-zinc-950 hover:bg-zinc-800",
          )}
        >
          Створити v{nextVersion}
        </button>
      </div>
    </div>
  );
}

export function MetaStrip({
  estimateName,
  setEstimateName,
  mode,
  currency,
  basedOn,
  changeNote,
  setChangeNote,
}: {
  estimateName: string;
  setEstimateName: (v: string) => void;
  mode: PageMode;
  currency: string;
  basedOn?: string;
  changeNote: string;
  setChangeNote: (v: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Назва розрахунку">
          <input
            value={estimateName}
            onChange={(e) => setEstimateName(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none ring-0 transition placeholder:text-zinc-400 focus:border-zinc-400"
            placeholder="Назва розрахунку"
          />
        </Field>
        <Field label="База">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {basedOn ?? "Перегляд"}
          </div>
        </Field>
        <Field label="Валюта">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
            {currency}
          </div>
        </Field>
        <Field label="Коментар до версії">
          <input
            disabled={mode !== "draft"}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none ring-0 transition placeholder:text-zinc-400 focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Що змінилось"
          />
        </Field>
      </div>
    </section>
  );
}

export function ReadonlyItemCard({
  item,
  currency,
}: {
  item: VersionItem;
  currency: string;
}) {
  return (
    <div className="rounded-[24px] border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone="zinc">
              {ESTIMATE_CATEGORY_LABELS[item.categoryKey]}
            </StatusChip>
            {item.supplier && <StatusChip tone="blue">{item.supplier}</StatusChip>}
            {item.unitPriceSource === "manual" ? (
              <StatusChip tone="amber">Ручна ціна</StatusChip>
            ) : (
              <StatusChip tone="green">Знімок постачальника</StatusChip>
            )}
          </div>
          <div className="mt-3 text-base font-semibold text-zinc-950">{item.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
            {item.supplierMaterialCode ? (
              <span>Код: {item.supplierMaterialCode}</span>
            ) : null}
            {item.supplierPriceSnapshot ? (
              <span>
                Знімок:{" "}
                {new Date(item.supplierPriceSnapshot.capturedAt).toLocaleDateString(
                  "uk-UA",
                )}
              </span>
            ) : null}
          </div>
          {item.note ? (
            <div className="mt-2 text-sm text-zinc-500">{item.note}</div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[420px]">
          <MiniStat label="К-ть" value={String(item.qty)} />
          <MiniStat label="Коef" value={String(item.coefficient)} />
          <MiniStat label="Ціна/од." value={formatMoney(item.unitPrice, currency)} />
          <MiniStat label="Разом" value={formatMoney(item.totalPrice, currency)} strong />
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] p-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={cn("mt-2 text-sm text-zinc-900", strong && "font-semibold")}>
        {value}
      </div>
    </div>
  );
}

export function EditableItemCard({
  item,
  marker,
  searchQuery,
  onSearchQueryChange,
  materialHits,
  onChange,
  onSelectMaterial,
  onDuplicate,
  onRemove,
  onResetSupplierPrice,
}: {
  item: DraftItem;
  marker: "added" | "changed" | null;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  materialHits: MaterialSearchHit[];
  onChange: (patch: Partial<DraftItem>) => void;
  onSelectMaterial: (material: MaterialSearchHit) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResetSupplierPrice: () => void;
}) {
  const showDropdown = searchQuery.trim().length > 0 || materialHits.length > 0;

  return (
    <div
      className={cn(
        "rounded-[24px] border p-4 transition",
        marker === "added"
          ? "border-emerald-200 bg-emerald-50/50"
          : marker === "changed"
            ? "border-blue-200 bg-blue-50/50"
            : "border-zinc-200 bg-zinc-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="mt-1 rounded-xl bg-[var(--enver-card)] p-2 text-zinc-500 shadow-sm">
            <GripVertical className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Позиція #{item.sortOrder}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {marker === "added" && <StatusChip tone="green">Додано</StatusChip>}
              {marker === "changed" && <StatusChip tone="blue">Змінено</StatusChip>}
              {item.supplier && <StatusChip tone="zinc">{item.supplier}</StatusChip>}
              {item.unitPriceSource === "manual" ? (
                <StatusChip tone="amber">Ручна ціна</StatusChip>
              ) : item.supplierPriceSnapshot ? (
                <StatusChip tone="green">Знімок</StatusChip>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <IconBtn icon={<Copy className="h-4 w-4" />} onClick={onDuplicate} />
          <IconBtn icon={<Trash2 className="h-4 w-4" />} onClick={onRemove} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.2fr)]">
        <Field label="Категорія">
          <CategorySelect
            value={item.categoryKey}
            onChange={(k) => onChange({ categoryKey: k })}
          />
        </Field>

        <Field label="Назва">
          <input
            value={item.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            placeholder="Назва позиції"
          />
        </Field>

        <Field label="Матеріал">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] pl-10 pr-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
              placeholder="Знайти матеріал або код"
            />
            {showDropdown ? (
              <div className="absolute z-20 mt-2 max-h-56 w-full overflow-y-auto rounded-2xl border border-zinc-200 bg-[var(--enver-card)] p-2 shadow-xl">
                {materialHits.length > 0 ? (
                  <div className="space-y-1">
                    {materialHits.map((material) => (
                      <button
                        key={material.materialId + material.code}
                        type="button"
                        onClick={() => onSelectMaterial(material)}
                        className="block w-full rounded-xl px-3 py-3 text-left transition hover:bg-zinc-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-zinc-900">
                              {material.name}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                              <span>Код: {material.code}</span>
                              <span>•</span>
                              <span>{material.supplier}</span>
                            </div>
                          </div>
                          <div className="whitespace-nowrap text-sm font-semibold text-zinc-900">
                            {formatMoney(material.price, material.currency)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-zinc-50 px-3 py-4 text-sm text-zinc-600">
                    Нічого не знайдено — введіть назву та ціну вручну.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="К-ть">
          <NumberInput value={item.qty} onChange={(v) => onChange({ qty: v })} />
        </Field>
        <Field label="Коеф.">
          <NumberInput
            value={item.coefficient}
            onChange={(v) => onChange({ coefficient: v })}
            step="0.1"
          />
        </Field>
        <Field label="Ціна/од.">
          <NumberInput
            value={item.unitPrice}
            onChange={(v) => onChange({ unitPrice: v, unitPriceSource: "manual" })}
          />
        </Field>
        <Field label="Разом">
          <div className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm font-semibold text-zinc-950">
            {formatMoney(item.totalPrice)}
          </div>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
        <Field label="Нотатка">
          <input
            value={item.note ?? ""}
            onChange={(e) => onChange({ note: e.target.value })}
            className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            placeholder="Коментар"
          />
        </Field>
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-[var(--enver-card)] p-3 text-xs text-zinc-600">
          <div className="font-medium text-zinc-800">Постачальник</div>
          <div>
            {item.supplierMaterialCode
              ? `Код: ${item.supplierMaterialCode}`
              : "Код не вибрано"}
          </div>
          <div>
            {item.supplierPriceSnapshot
              ? `Знімок: ${formatMoney(item.supplierPriceSnapshot.price, item.supplierPriceSnapshot.currency)}`
              : "Знімок відсутній"}
          </div>
          <button
            type="button"
            disabled={!item.supplierPriceSnapshot}
            onClick={onResetSupplierPrice}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Скинути ціну постачальника
          </button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-[var(--enver-card)] text-zinc-700 transition hover:bg-zinc-50"
    >
      {icon}
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  step = "1",
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
}) {
  return (
    <input
      type="number"
      value={Number.isNaN(value) ? 0 : value}
      step={step}
      min="0"
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
    />
  );
}

export function TotalsBlock({
  total,
  subtotal,
  itemsCount,
  manualAdjustments,
  delta,
  currency,
}: {
  total: number;
  subtotal: number;
  itemsCount: number;
  manualAdjustments: number;
  delta: number;
  currency: string;
}) {
  const deltaSign = delta > 0 ? "+" : "";
  return (
    <div className="mt-5 rounded-[24px] bg-zinc-950 p-5 text-white shadow-lg shadow-zinc-950/10">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] lg:items-end">
        <div>
          <div className="text-sm text-zinc-300">Всього</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">
            {formatMoney(total, currency)}
          </div>
        </div>
        <BigMini label="Підсумок" value={formatMoney(subtotal, currency)} />
        <BigMini label="Позицій" value={String(itemsCount)} />
        <BigMini label="Ручних цін" value={String(manualAdjustments)} />
        <BigMini
          label="Δ до бази"
          value={`${deltaSign}${formatMoney(delta, currency)}`}
        />
      </div>
    </div>
  );
}

function BigMini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-2 text-lg font-medium text-white">{value}</div>
    </div>
  );
}

export function DiffPreview({
  diff,
  currency,
  title,
}: {
  diff: DiffResult;
  currency: string;
  title: string;
}) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
      <SectionTitle
        icon={<History className="h-4 w-4" />}
        title={title}
        description="Додано, видалено, змінено, delta по сумі."
      />

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryMiniCard label="Додано" value={String(diff.added.length)} />
        <SummaryMiniCard label="Видалено" value={String(diff.removed.length)} />
        <SummaryMiniCard label="Змінено" value={String(diff.changed.length)} />
        <SummaryMiniCard label="Δ суми" value={formatMoney(diff.totalDelta, currency)} />
      </div>

      <div className="mt-5 space-y-5">
        <DiffGroup title="Додані" count={diff.added.length}>
          {diff.added.length === 0 ? (
            <EmptyDiffText />
          ) : (
            <div className="space-y-3">
              {diff.added.map((item) => (
                <div
                  key={item.tempId}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
                >
                  <div className="font-medium text-zinc-900">
                    {item.title || "Без назви"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-700">
                    <span>К-ть: {item.qty}</span>
                    <span>Разом: {formatMoney(item.totalPrice, currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiffGroup>

        <DiffGroup title="Видалені" count={diff.removed.length}>
          {diff.removed.length === 0 ? (
            <EmptyDiffText />
          ) : (
            <div className="space-y-3">
              {diff.removed.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-rose-200 bg-rose-50 p-4"
                >
                  <div className="font-medium text-zinc-900">{item.title}</div>
                  <div className="mt-2 text-sm text-zinc-700">
                    {formatMoney(item.totalPrice, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiffGroup>

        <DiffGroup title="Змінені" count={diff.changed.length}>
          {diff.changed.length === 0 ? (
            <EmptyDiffText />
          ) : (
            <div className="space-y-3">
              {diff.changed.map((item) => (
                <div
                  key={item.baseItemId}
                  className="rounded-2xl border border-blue-200 bg-blue-50 p-4"
                >
                  <div className="font-medium text-zinc-900">{item.title}</div>
                  <div className="mt-3 space-y-2 text-sm text-zinc-700">
                    {item.fields.map((field) => (
                      <div key={field.field} className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-900">{field.field}:</span>
                        <span>{String(field.from)}</span>
                        <span>→</span>
                        <span>{String(field.to)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DiffGroup>
      </div>
    </section>
  );
}

function SummaryMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

function DiffGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        <StatusChip tone="zinc">{count}</StatusChip>
      </div>
      {children}
    </div>
  );
}

function EmptyDiffText() {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
      Немає змін у цій групі
    </div>
  );
}

export function BottomActionBar({
  nextVersion,
  total,
  disabled,
  onDiscard,
  onPublish,
}: {
  nextVersion: number;
  total: number;
  disabled: boolean;
  onDiscard: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="sticky bottom-4 z-30 flex flex-col gap-3 rounded-[28px] border border-zinc-200 bg-[var(--enver-card)]/95 p-4 shadow-2xl backdrop-blur md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-sm text-zinc-500">Готово до публікації</div>
        <div className="mt-1 text-lg font-semibold text-zinc-950">
          v{nextVersion} · {formatMoney(total)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
        >
          Скасувати чернетку
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onPublish}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm font-medium text-white transition",
            disabled ? "cursor-not-allowed bg-zinc-300" : "bg-zinc-950 hover:bg-zinc-800",
          )}
        >
          Створити v{nextVersion}
        </button>
      </div>
    </div>
  );
}

export function SidebarComposer({
  mode,
  currentVersion,
  selectedVersion,
  compareFrom,
  compareTo,
  draftTotal,
  draftItemsCount,
  diff,
  versions,
  compareFromId,
  compareToId,
  onSelectVersion,
  onUseAsBase,
  onCompare,
  onChangeCompareFrom,
  onChangeCompareTo,
  onOpenCompareMode,
  onNewVersion,
  onCreateProposal,
  leadId,
}: {
  mode: PageMode;
  currentVersion: EstimateVersionModel;
  selectedVersion: EstimateVersionModel;
  compareFrom: EstimateVersionModel;
  compareTo: EstimateVersionModel;
  draftTotal: number;
  draftItemsCount: number;
  diff: DiffResult | null;
  versions: EstimateVersionModel[];
  compareFromId: string;
  compareToId: string;
  onSelectVersion: (id: string) => void;
  onUseAsBase: (id: string) => void;
  onCompare: (id: string) => void;
  onChangeCompareFrom: (id: string) => void;
  onChangeCompareTo: (id: string) => void;
  onOpenCompareMode: () => void;
  onNewVersion: () => void;
  onCreateProposal: () => void;
  leadId: string;
}) {
  return (
    <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Підсумок</div>
        <div className="mt-4 space-y-3 text-sm">
          <SidebarRow
            label="Режим"
            value={
              mode === "draft" ? "Чернетка" : mode === "compare" ? "Порівняння" : "Перегляд"
            }
          />
          <SidebarRow
            label="Версія"
            value={
              mode === "draft"
                ? `Нова v${currentVersion.versionNumber + 1}`
                : `v${selectedVersion.versionNumber}`
            }
          />
          <SidebarRow
            label="Разом"
            value={
              mode === "draft"
                ? formatMoney(draftTotal)
                : formatMoney(selectedVersion.total)
            }
            strong
          />
          <SidebarRow
            label="Позицій"
            value={
              mode === "draft"
                ? String(draftItemsCount)
                : String(selectedVersion.items.length)
            }
          />
          {diff ? <SidebarRow label="Δ" value={formatMoney(diff.totalDelta)} strong /> : null}
        </div>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-900">Історія</div>
          <button
            type="button"
            onClick={onNewVersion}
            className="rounded-xl bg-zinc-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800"
          >
            Нова версія
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {versions.map((version) => (
            <div key={version.id} className="rounded-2xl border border-zinc-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-zinc-900">
                      v{version.versionNumber}
                    </div>
                    <StatusChip tone={version.status === "current" ? "green" : "zinc"}>
                      {version.status}
                    </StatusChip>
                  </div>
                  <div className="mt-2 text-sm font-medium text-zinc-900">
                    {formatMoney(version.total)}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectVersion(version.id)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                  >
                    Відкрити
                  </button>
                  <button
                    type="button"
                    onClick={() => onCompare(version.id)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                  >
                    Порівняти
                  </button>
                  <button
                    type="button"
                    onClick={() => onUseAsBase(version.id)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                  >
                    База
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Порівняння</div>
        <div className="mt-4 space-y-3">
          <Field label="З">
            <select
              value={compareFromId}
              onChange={(e) => onChangeCompareFrom(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber}
                </option>
              ))}
            </select>
          </Field>
          <Field label="До">
            <select
              value={compareToId}
              onChange={(e) => onChangeCompareTo(e.target.value)}
              className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none transition focus:border-zinc-400"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.versionNumber}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            onClick={onOpenCompareMode}
            className="w-full rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50"
          >
            Відкрити порівняння
          </button>
          <div className="rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-600">
            v{compareFrom.versionNumber} → v{compareTo.versionNumber}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-zinc-200 bg-[var(--enver-card)] p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Швидкі дії</div>
        <div className="mt-4 grid gap-2">
          <QuickBtn icon={<Plus className="h-4 w-4" />} label="Нова версія" onClick={onNewVersion} />
          <QuickBtn
            icon={<FileText className="h-4 w-4" />}
            label="Створити КП"
            onClick={onCreateProposal}
          />
          <QuickBtn
            icon={<PackageSearch className="h-4 w-4" />}
            label="Файли ліда"
            onClick={() => {
              window.location.href = `/leads/${leadId}/files`;
            }}
          />
        </div>
      </div>
    </aside>
  );
}

function SidebarRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-zinc-500">{label}</div>
      <div className={cn("text-right text-zinc-900", strong && "font-semibold")}>
        {value}
      </div>
    </div>
  );
}

function QuickBtn({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
    >
      <span className="inline-flex items-center gap-2">
        {icon}
        {label}
      </span>
      <ChevronRight className="h-4 w-4 text-zinc-400" />
    </button>
  );
}

export function QuickAddPreset({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-zinc-200 bg-[var(--enver-card)] px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
    >
      + {label}
    </button>
  );
}

export { ClipboardList, Layers3, Sparkles, Wand2 };

export function getDraftItemMarker(
  item: DraftItem,
  currentVersion: EstimateVersionModel,
  diff: DiffResult | null,
): "added" | "changed" | null {
  if (!diff) return null;
  if (!item.baseItemId) return "added";
  const changed = diff.changed.some((entry) => entry.baseItemId === item.baseItemId);
  if (changed) return "changed";
  return null;
}
