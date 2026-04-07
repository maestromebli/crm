"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { LeadAttachmentListItem } from "../../leads/queries";
import { patchJson } from "../../../lib/api/patch-json";
import { cn } from "../../../lib/utils";

const AI_CAT_UA: Record<string, string> = {
  PROJECT: "Проєкт",
  PHOTO: "Фото",
  DIMENSIONS: "Розміри",
  MEASUREMENT: "Замір",
  COMMERCIAL_PROPOSAL: "КП",
  CONTRACT: "Договір",
  INVOICE: "Рахунок",
  TECHNICAL: "Технічний документ",
  VISUALIZATION: "Візуалізація",
  MESSENGER_SCREENSHOT: "Переписка / скрін",
  OTHER: "Інше",
};

const STATUS_UA: Record<string, string> = {
  PENDING: "В черзі",
  PROCESSING: "Аналіз…",
  COMPLETED: "Готово",
  FAILED: "Помилка",
  SKIPPED_NO_LOCAL_FILE: "Немає файлу",
  SKIPPED_NO_AI_KEY: "Без ШІ-ключа",
};

export function LeadFileIntelBadge({
  item,
  canUpload,
  onIntelUpdated,
}: {
  item: LeadAttachmentListItem;
  canUpload: boolean;
  onIntelUpdated?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const intel = item.fileIntel;

  if (!intel) {
    return (
      <span className="text-[10px] text-slate-400">
        AI: підготовка аналізу…
      </span>
    );
  }

  const label =
    intel.userConfirmedCategory ??
    intel.detectedCategory ??
    "OTHER";
  const ua = AI_CAT_UA[label] ?? label;
  const st = STATUS_UA[intel.processingStatus] ?? intel.processingStatus;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition",
          intel.processingStatus === "COMPLETED"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : intel.processingStatus === "FAILED"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-600",
        )}
      >
        <Sparkles className="h-3 w-3 shrink-0 opacity-70" />
        {ua} · {st}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Аналіз файлу"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[min(90vh,560px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--enver-text)]">
                Аналіз файлу (AI)
              </h3>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                Закрити
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{item.fileName}</p>
            <dl className="mt-3 space-y-2 text-xs">
              <div>
                <dt className="text-slate-500">Статус обробки</dt>
                <dd className="font-medium text-slate-800">{st}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Визначена категорія</dt>
                <dd>{ua}</dd>
              </div>
              {intel.confidenceScore != null ? (
                <div>
                  <dt className="text-slate-500">Впевненість</dt>
                  <dd>{Math.round(intel.confidenceScore * 100)}%</dd>
                </div>
              ) : null}
              {intel.shortSummary ? (
                <div>
                  <dt className="text-slate-500">Короткий підсумок</dt>
                  <dd className="whitespace-pre-wrap text-slate-700">
                    {intel.shortSummary}
                  </dd>
                </div>
              ) : null}
            </dl>
            {canUpload &&
            (intel.detectedCategory || intel.userConfirmedCategory) ? (
              <ConfirmCategoryInline
                attachmentId={item.id}
                current={intel.userConfirmedCategory ?? intel.detectedCategory}
                onDone={() => {
                  setOpen(false);
                  onIntelUpdated?.();
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ConfirmCategoryInline({
  attachmentId,
  current,
  onDone,
}: {
  attachmentId: string;
  current: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <p className="text-[11px] font-medium text-slate-700">
        Підтвердити категорію
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
        >
          {Object.entries(AI_CAT_UA).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || value === current}
          onClick={() => void (async () => {
            setBusy(true);
            setErr(null);
            try {
              await patchJson(`/api/ai/file-extraction/${attachmentId}`, {
                userConfirmedCategory: value,
              });
              onDone();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Помилка");
            } finally {
              setBusy(false);
            }
          })()}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {busy ? "Збереження…" : "Зберегти"}
        </button>
      </div>
      {err ? <p className="mt-2 text-[11px] text-rose-600">{err}</p> : null}
    </div>
  );
}
