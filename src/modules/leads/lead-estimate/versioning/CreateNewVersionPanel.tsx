"use client";

const btnPrimary =
  "rounded-lg border border-blue-700 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-slate-200 bg-[var(--enver-card)] px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-[var(--enver-hover)] disabled:opacity-50";

type Props = {
  newVersion: number;
  currentVersion: number;
  oldTotal: number | null;
  newTotal: number | null;
  bullets: string[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CreateNewVersionPanel({
  newVersion,
  currentVersion,
  oldTotal,
  newTotal,
  bullets,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-4 pt-10 md:px-6">
      <div className="pointer-events-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-[var(--enver-card)] p-4 shadow-2xl shadow-slate-900/15">
        <p className="text-sm font-bold text-[var(--enver-text)]">
          Підтвердження нової версії
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {`Буде створена нова смета v${newVersion} як оновлена версія. Поточна смета v${currentVersion} буде архівована. Дані не втрачаються.`}
        </p>
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/90 p-3 text-[11px] shadow-inner">
          <p className="font-semibold text-slate-800">
            Разом:{" "}
            <span className="tabular-nums">
              {oldTotal != null ? oldTotal.toLocaleString("uk-UA") : "—"}
            </span>
            {" → "}
            <span className="font-bold text-emerald-800 tabular-nums">
              {newTotal != null ? newTotal.toLocaleString("uk-UA") : "—"} грн
            </span>
          </p>
          {bullets.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-slate-600">
              {bullets.slice(0, 6).map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" className={btnGhost} disabled={busy} onClick={onCancel}>
            Скасувати
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Створення…" : "Створити нову версію смети"}
          </button>
        </div>
      </div>
    </div>
  );
}
