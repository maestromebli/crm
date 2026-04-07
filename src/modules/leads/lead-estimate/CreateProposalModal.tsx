"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Info } from "lucide-react";

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
};

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
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [summary, setSummary] = useState(defaultSummary);
  const [visualizationUrls, setVisualizationUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setSummary(defaultSummary.trim() || "");
    setVisualizationUrls(Array(kpVisualizationRows.length).fill(""));
    setNotes("");
    setErr(null);
  }, [open, defaultTitle, defaultSummary, kpVisualizationRows.length]);

  if (!open) return null;

  const submit = async (openPreview: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateId,
          title: title.trim() || undefined,
          notes: notes.trim() || undefined,
          summary: summary.trim() || undefined,
          visualizationUrls: visualizationUrls.map((u) => u.trim()),
        }),
      });
      const j = (await r.json()) as {
        error?: string;
        details?: string;
        warning?: string;
        proposal?: { id: string; publicToken?: string | null };
      };
      if (!r.ok) {
        const base = j.error ?? "Помилка";
        const detail =
          typeof j.details === "string" && j.details.trim()
            ? `\n\n${j.details.trim()}`
            : "";
        throw new Error(`${base}${detail}`);
      }
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
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <ImageIcon className="h-3.5 w-3.5 text-slate-500" />
              Візуалізація (посилання на зображення)
            </span>
            <span className="block text-[10px] font-normal text-slate-500">
              Колонка «Віз» у таблиці КП: по одному URL на рядок (позиція 1, 2, …).
              Якщо поле порожнє — підставиться фото з файлів ліда, якщо є.
            </span>
            {kpVisualizationRows.length === 0 ? (
              <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50/80 px-2 py-2 text-[11px] text-amber-900">
                У розрахунку немає згрупованих позицій для КП — додайте рядки в
                таблицю, збережіть смету й відкрийте вікно знову.
              </p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                {kpVisualizationRows.map((row, i) => (
                  <li key={i}>
                    <label className="block">
                      <span className="line-clamp-2 text-[10px] font-medium text-slate-600">
                        {i + 1}. {row.title || "Позиція"}
                      </span>
                      <input
                        type="url"
                        inputMode="url"
                        value={visualizationUrls[i] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setVisualizationUrls((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        placeholder="https://…"
                        className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      />
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
