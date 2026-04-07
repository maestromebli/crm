"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import type { CompareEstimateVersionsResult } from "../../lib/estimates/compare-estimate-versions";
import type { SectionModel } from "./useDealEstimateWorkspace";

const btnPrimary =
  "rounded-[12px] bg-[#2563EB] px-3 py-2 text-[14px] font-medium text-white transition hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-[12px] border border-[#E5E7EB] bg-white px-3 py-2 text-[14px] font-medium text-[#111111] transition hover:bg-[#FAFAFA]";

export function EstimateCompareModal({
  open,
  onOpenChange,
  dealId,
  fromId,
  toId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dealId: string;
  fromId: string | null;
  toId: string | null;
}) {
  const [data, setData] = useState<CompareEstimateVersionsResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !fromId || !toId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const r = await fetch(
          `/api/deals/${dealId}/estimates/compare?from=${encodeURIComponent(fromId)}&to=${encodeURIComponent(toId)}`,
        );
        const j = (await r.json()) as CompareEstimateVersionsResult & { error?: string };
        if (!r.ok) throw new Error(j.error ?? "Помилка");
        if (!cancelled) setData(j as CompareEstimateVersionsResult);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Помилка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, dealId, fromId, toId]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(960px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-lg outline-none">
          <Dialog.Title className="text-[18px] font-medium text-[#111111]">
            Порівняння версій
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-[12px] text-[#6B7280]">
            Зміни між обраними версіями смети.
          </Dialog.Description>
          {loading ? (
            <p className="mt-4 text-[14px] text-[#6B7280]">Завантаження…</p>
          ) : err ? (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[14px] text-[#DC2626]">
              {err}
            </p>
          ) : data ? (
            <div className="mt-4 max-h-[55vh] space-y-3 overflow-auto text-[14px]">
              <div className="grid grid-cols-2 gap-2 text-[12px] text-[#6B7280]">
                <div>
                  v{data.fromVersion.versionNumber} ·{" "}
                  {data.fromVersion.total != null
                    ? `${data.fromVersion.total.toLocaleString("uk-UA")} грн`
                    : "—"}
                </div>
                <div>
                  v{data.toVersion.versionNumber} ·{" "}
                  {data.toVersion.total != null
                    ? `${data.toVersion.total.toLocaleString("uk-UA")} грн`
                    : "—"}
                </div>
              </div>
              <p className="text-[#111111]">
                Додано: {data.summary.added}, видалено: {data.summary.removed},
                змінено: {data.summary.changed}. Δ суми:{" "}
                {data.summary.totalDelta.toLocaleString("uk-UA")} грн
              </p>
              {data.changedItems.length > 0 ? (
                <ul className="space-y-2 border-t border-[#E5E7EB] pt-3">
                  {data.changedItems.slice(0, 40).map((c, i) => (
                    <li
                      key={`${c.title}-${i}`}
                      className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2"
                    >
                      <span className="font-medium">{c.title}</span>
                      <ul className="mt-1 text-[12px] text-[#6B7280]">
                        {c.fields.map((f) => (
                          <li key={f.field}>
                            {f.field}: {f.from} → {f.to}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Dialog.Close className={btnGhost}>Закрити</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function GenerateQuoteModal({
  open,
  onOpenChange,
  sections,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sections: SectionModel[];
  onConfirm: (opts: {
    sectionIds: string[];
    includeBreakdown: boolean;
    includeDelivery: boolean;
    includeInstallation: boolean;
    note: string;
  }) => void;
}) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [breakdown, setBreakdown] = useState(true);
  const [delivery, setDelivery] = useState(true);
  const [install, setInstall] = useState(true);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const init: Record<string, boolean> = {};
    for (const s of sections) init[s.id] = true;
    setSelected(init);
  }, [open, sections]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(520px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-lg outline-none">
          <Dialog.Title className="text-[18px] font-medium text-[#111111]">
            Підготовка комерційної пропозиції
          </Dialog.Title>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Оберіть секції та параметри знімка для КП. Внутрішні поля можна
            приховати в налаштуваннях розрахунку.
          </p>
          <div className="mt-4 max-h-40 space-y-2 overflow-auto">
            {sections.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 text-[14px] text-[#111111]"
              >
                <input
                  type="checkbox"
                  checked={selected[s.id] !== false}
                  onChange={(e) =>
                    setSelected((x) => ({ ...x, [s.id]: e.target.checked }))
                  }
                />
                {s.title}
              </label>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-[14px]">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={breakdown}
                onChange={(e) => setBreakdown(e.target.checked)}
              />
              Деталізація по позиціях
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={delivery}
                onChange={(e) => setDelivery(e.target.checked)}
              />
              Умови доставки
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={install}
                onChange={(e) => setInstall(e.target.checked)}
              />
              Умови монтажу
            </label>
          </div>
          <label className="mt-4 block text-[14px]">
            <span className="text-[#6B7280]">Коментар до КП</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#2563EB]"
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close className={btnGhost}>Скасувати</Dialog.Close>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                onConfirm({
                  sectionIds: sections.filter((s) => selected[s.id] !== false).map((s) => s.id),
                  includeBreakdown: breakdown,
                  includeDelivery: delivery,
                  includeInstallation: install,
                  note: note.trim(),
                });
                onOpenChange(false);
              }}
            >
              Перейти до КП
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function FormulaEditorModal({
  open,
  onOpenChange,
  initialMode,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialMode: string;
  onSave: (mode: string, label: string) => void;
}) {
  const [mode, setMode] = useState(initialMode);
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setLabel("");
    }
  }, [open, initialMode]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(480px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-[12px] border border-[#E5E7EB] bg-white p-6 shadow-lg outline-none">
          <Dialog.Title className="text-[18px] font-medium text-[#111111]">
            Режим розрахунку
          </Dialog.Title>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            Оберіть зрозумілий режим замість «сирих» формул Excel.
          </p>
          <label className="mt-4 block text-[14px]">
            <span className="text-[#6B7280]">Тип</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="mt-1 w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px]"
            >
              <option value="manual">Вручну (фіксована ціна рядка)</option>
              <option value="by_qty">Кількість × ціна</option>
              <option value="by_area">Площа (м²) × ціна</option>
              <option value="running_meter">Погонні метри × ціна</option>
              <option value="module">Модуль / комплект</option>
              <option value="custom_formula">Кастом (спрощено)</option>
            </select>
          </label>
          <label className="mt-3 block text-[14px]">
            <span className="text-[#6B7280]">Підпис для команди</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-[12px] border border-[#E5E7EB] px-3 py-2 text-[14px]"
              placeholder="Напр. площа фасаду"
            />
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close className={btnGhost}>Скасувати</Dialog.Close>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                onSave(mode, label);
                onOpenChange(false);
              }}
            >
              Застосувати
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
