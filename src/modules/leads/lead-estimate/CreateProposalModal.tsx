"use client";

import { useEffect, useState, type ClipboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Info, Loader2, Download as Вивантажити } from "lucide-react";
import { postFormData, postJson } from "../../../lib/api/patch-json";

type Props = {
  open: boolean;
  onClose: () => void;
  leadId: string;
  estimateId: string;
  estimateVersion: number;
  totalPrice: number | null;
  /** Заголовок КП за замовчуванням (наприклад «КП v3»). */
  defaultTitle: string;
  /** Підказка з смети (короткий зріз) — показуємо як довідник, не як готовий текст. */
  summaryHint: string;
  /** Початковий текст для «Опис матеріалів», якщо потрібно (наприклад назва розрахунку). */
  defaultSummary?: string;
  /** Рядки КП (як у таблиці) — по одному полю URL на позицію, індекс 1:1. */
  kpVisualizationRows: { title: string }[];
  /** URL зображень з файлів ліда — автоматично підставляються у поля «Віз» (по порядку). */
  leadImageUrls?: string[];
  /** Актуальні рядки смети з UI (якщо є незбережені локальні зміни). */
  sourceEstimateLines?: Array<{
    id: string;
    type: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  }>;
  sourceEstimateName?: string | null;
  sourceEstimateTemplateKey?: string | null;
};

type QuoteGroupingMode = "group" | "furniture_type";
type QuoteMaterialBucket =
  | "dsp"
  | "facades"
  | "hardware"
  | "countertop"
  | "services"
  | "other";

const QUOTE_BUCKET_OPTIONS: Array<{ key: QuoteMaterialBucket; label: string }> = [
  { key: "dsp", label: "ДСП / корпус" },
  { key: "hardware", label: "Фурнітура" },
  { key: "facades", label: "Фасади" },
  { key: "countertop", label: "Стільниця" },
  { key: "services", label: "Сервіс / монтаж / доставка" },
  { key: "other", label: "Інше" },
];

const btn =
  "rounded-lg border border-blue-700 bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/15 hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-[var(--enver-hover)] disabled:opacity-50";

function formatUah(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return (
    new Intl.NumberFormat("uk-UA", {
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n) + " грн"
  );
}

function normalizeVisualizationUrlFromPaste(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const firstToken = trimmed.split(/\s+/)[0] ?? "";
  if (!firstToken) return "";
  if (/^https?:\/\//i.test(firstToken)) return firstToken;
  if (firstToken.startsWith("/")) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}${firstToken}`;
    }
    return firstToken;
  }
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(firstToken)) {
    return `https://${firstToken}`;
  }
  return firstToken;
}

export function CreateProposalModal({
  open,
  onClose,
  leadId,
  estimateId,
  estimateVersion,
  totalPrice,
  defaultTitle,
  summaryHint,
  defaultSummary = "",
  kpVisualizationRows,
  leadImageUrls,
  sourceEstimateLines,
  sourceEstimateName,
  sourceEstimateTemplateKey,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [summary, setSummary] = useState(defaultSummary);
  const [visualizationUrls, setVisualizationUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quoteMaterialBuckets, setQuoteMaterialBuckets] = useState<
    QuoteMaterialBucket[]
  >(["dsp", "hardware", "facades", "countertop", "services", "other"]);
  const [busy, setBusy] = useState(false);
  const [uploadingVisualizationIndex, setUploadingVisualizationIndex] = useState<
    number | null
  >(null);
  const [dragOverVisualizationIndex, setDragOverVisualizationIndex] = useState<
    number | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  const previewRows = (() => {
    const seen = new Set<string>();
    return kpVisualizationRows.filter((row) => {
      const key = (row.title || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const fillVisualizationsFromLeadFiles = () => {
    const len = previewRows.length;
    if (len === 0 || !leadImageUrls?.length) return;
    setVisualizationUrls(() => {
      const next = Array(len).fill("") as string[];
      for (let i = 0; i < len; i++) {
        next[i] = leadImageUrls[i]?.trim() ?? "";
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setSummary(defaultSummary.trim() || "");
    const len = previewRows.length;
    const initial = Array(len).fill("") as string[];
    if (leadImageUrls?.length && len > 0) {
      for (let i = 0; i < Math.min(len, leadImageUrls.length); i++) {
        const u = leadImageUrls[i]?.trim();
        if (u) initial[i] = u;
      }
    }
    setVisualizationUrls(initial);
    setNotes("");
    setErr(null);
    setQuoteMaterialBuckets([
      "dsp",
      "hardware",
      "facades",
      "countertop",
      "services",
      "other",
    ]);
  }, [
    open,
    defaultTitle,
    defaultSummary,
    previewRows.length,
    leadImageUrls,
  ]);

  useEffect(() => {
    setVisualizationUrls((prev) => {
      const len = previewRows.length;
      if (prev.length === len) return prev;
      const next = Array(len).fill("") as string[];
      for (let i = 0; i < Math.min(prev.length, len); i++) {
        next[i] = prev[i] ?? "";
      }
      return next;
    });
  }, [previewRows.length]);

  if (!open) return null;

  const submit = async (openPreview: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        error?: string;
        details?: string;
        warning?: string;
        proposal?: { id: string; publicToken?: string | null };
      }>(`/api/leads/${leadId}/proposals`, {
        estimateId,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        summary: summary.trim() || undefined,
        visualizationUrls: visualizationUrls.map((u) => u.trim()),
        quoteGroupingMode: "furniture_type" as QuoteGroupingMode,
        quoteMaterialBuckets,
        ...(sourceEstimateLines && sourceEstimateLines.length > 0
          ? {
              sourceEstimateLines,
              sourceEstimateName: sourceEstimateName ?? null,
              sourceEstimateTemplateKey: sourceEstimateTemplateKey ?? null,
            }
          : {}),
      });
      if (typeof j.warning === "string" && j.warning.trim()) {
        window.alert(j.warning.trim());
      }
      onClose();
      router.refresh();
      const token = j.proposal?.publicToken;
      if (openPreview && token) {
        window.open(`/p/${token}`, "_blank", "noopener,noreferrer");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const handleVisualizationPaste = (
    index: number,
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/"),
    );
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) {
        event.preventDefault();
        void uploadVisualizationFile(index, file);
        return;
      }
    }
    const pasted = event.clipboardData.getData("text/plain");
    const normalized = normalizeVisualizationUrlFromPaste(pasted);
    if (!normalized) return;
    event.preventDefault();
    setVisualizationUrls((prev) => {
      const next = [...prev];
      next[index] = normalized;
      return next;
    });
  };

  const uploadVisualizationFile = async (index: number, file: File) => {
    if (!file.type.startsWith("image/")) {
      setErr("Можна завантажувати лише зображення (jpg, png, webp, gif).");
      return;
    }
    setErr(null);
    setUploadingVisualizationIndex(index);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "OBJECT_PHOTO");
      const j = await postFormData<{
        id?: string;
        fileUrl?: string;
        fileName?: string;
        error?: string;
      }>(`/api/leads/${leadId}/attachments`, fd);
      if (!j.fileUrl) {
        throw new Error("Не вдалося отримати URL зображення");
      }
      setVisualizationUrls((prev) => {
        const next = [...prev];
        next[index] = j.fileUrl ?? "";
        return next;
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка завантаження зображення");
    } finally {
      setUploadingVisualizationIndex(null);
      setDragOverVisualizationIndex((prev) => (prev === index ? null : prev));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proposal-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200/90 bg-[var(--enver-card)] p-5 shadow-2xl shadow-slate-900/10">
        <h2
          id="proposal-modal-title"
          className="text-base font-bold text-[var(--enver-text)]"
        >
          Створити комерційну пропозицію (КП)
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          Знімок смети v{estimateVersion} буде зафіксовано в КП — подальші зміни
          смети цей документ не змінять.
        </p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Вартість за сметою
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[var(--enver-text)]">
            {formatUah(totalPrice)}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-[11px] text-slate-600">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            Сума береться з поточного розрахунку; у PDF і публічному перегляді
            також показуються знижка, доставка та монтаж, якщо вони задані в
            сметі.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-[11px]">
            <span className="font-medium text-slate-700">
              Назва об&apos;єкта / тема КП
            </span>
            <span className="block text-[10px] font-normal text-slate-500">
              Наприклад: кухня модульна, шафа-купе вітальня
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Кухня модульна"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>

          <label className="block text-[11px]">
            <span className="font-medium text-slate-700">
              Опис матеріалів та комплектуючих для клієнта
            </span>
            <span className="block text-[10px] font-normal text-slate-500">
              Відображається в блоці «Умови та коментарі» в кінці КП
            </span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="ЛДСП, фасади МДФ, фурнітура Blum, стільниця кварц…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>

          <div className="block text-[11px]">
            <span className="font-medium text-slate-700">
              Матеріали в описі рядка
            </span>
            <div className="mt-1 grid grid-cols-1 gap-1 rounded-lg border border-slate-200 bg-slate-50/70 p-2 sm:grid-cols-2">
              {QUOTE_BUCKET_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="inline-flex items-center gap-2 text-[11px] text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={quoteMaterialBuckets.includes(opt.key)}
                    onChange={(e) => {
                      setQuoteMaterialBuckets((prev) => {
                        if (e.target.checked) {
                          return [...prev, opt.key];
                        }
                        const next = prev.filter((x) => x !== opt.key);
                        return next.length > 0 ? next : prev;
                      });
                    }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="block text-[11px]">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
              Візуалізація (посилання на зображення)
            </span>
            <span className="block text-[10px] font-normal text-slate-500">
              Колонка «Віз» у таблиці КП: по одному URL на рядок (позиція 1, 2, …).
              Якщо на ліді завантажені зображення — вони підставляються автоматично
              (можна змінити вручну).
            </span>
            {previewRows.length > 0 &&
            leadImageUrls &&
            leadImageUrls.length > 0 ? (
              <button
                type="button"
                className="mt-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={fillVisualizationsFromLeadFiles}
              >
                Підставити з файлу ліда (перезаписати поля)
              </button>
            ) : null}
            {previewRows.length === 0 ? (
              <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 px-2 py-2 text-[11px] text-amber-900">
                У розрахунку немає згрупованих позицій для КП — додайте рядки в
                таблицю, збережіть смету й відкрийте вікно знову.
              </p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                {previewRows.map((row, i) => (
                  <li key={i}>
                    <label className="block">
                      <span className="line-clamp-2 text-[10px] font-medium text-slate-600">
                        {i + 1}. {row.title || "Позиція"}
                      </span>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <input
                          type="url"
                          inputMode="url"
                          value={visualizationUrls[i] ?? ""}
                          onPaste={(e) => handleVisualizationPaste(i, e)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverVisualizationIndex(i);
                          }}
                          onDragLeave={() =>
                            setDragOverVisualizationIndex((prev) =>
                              prev === i ? null : prev,
                            )
                          }
                          onDrop={(e) => {
                            e.preventDefault();
                            const file = e.dataTransfer.files?.[0];
                            if (!file) return;
                            void uploadVisualizationFile(i, file);
                          }}
                          onChange={(e) => {
                            const v = e.target.value;
                            setVisualizationUrls((prev) => {
                              const next = [...prev];
                              next[i] = v;
                              return next;
                            });
                          }}
                          placeholder="https://… або Ctrl+V / перетягніть зображення"
                          title="Підтримується URL, Ctrl+V (скрін), drag&drop, вибір файлу"
                          className={`w-full rounded-lg border px-2 py-1.5 text-sm ${
                            dragOverVisualizationIndex === i
                              ? "border-violet-400 bg-violet-50"
                              : "border-slate-200"
                          }`}
                        />
                        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
                          {uploadingVisualizationIndex === i ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Вивантажити className="h-3.5 w-3.5" />
                          )}
                          Фото
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.currentTarget.files?.[0];
                              if (!file) return;
                              void uploadVisualizationFile(i, file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="block text-[11px]">
            <span className="font-medium text-slate-700">
              Внутрішні нотатки (не для клієнта)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Лише для команди"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </label>
        </div>

        {summaryHint.trim() ? (
          <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-2 text-[11px] text-slate-700">
            <summary className="cursor-pointer font-medium text-slate-600">
              Довідка з смети (скорочено)
            </summary>
            <p className="mt-2 whitespace-pre-wrap leading-snug text-slate-600">
              {summaryHint}
            </p>
          </details>
        ) : null}

        {err ? (
          <p className="mt-3 text-xs text-rose-700">{err}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={onClose} disabled={busy}>
            Скасувати
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() => void submit(false)}
          >
            {busy ? "…" : "Створити КП"}
          </button>
          <button
            type="button"
            className={btn}
            disabled={busy}
            onClick={() => void submit(true)}
          >
            Створити й перегляд
          </button>
        </div>
      </div>
    </div>
  );
}
