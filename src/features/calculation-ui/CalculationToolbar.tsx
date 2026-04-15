"use client";

type Props = {
  version: string;
  onAddRow: () => void;
  onImportExcel: () => void;
  onSave: () => void;
  onConvertQuote: () => void;
};

const buttonCls =
  "inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50";

export function CalculationToolbar({
  version,
  onAddRow,
  onImportExcel,
  onSave,
  onConvertQuote,
}: Props) {
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
      <button type="button" className={buttonCls} onClick={onAddRow}>
        + Додати рядок
      </button>
      <button type="button" className={buttonCls} onClick={onImportExcel}>
        Імпорт Excel
      </button>
      <button type="button" className={buttonCls} onClick={onSave}>
        Зберегти
      </button>
      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
        {version}
      </span>
      <button
        type="button"
        className="ml-auto inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        onClick={onConvertQuote}
      >
        Конвертувати в КП
      </button>
    </div>
  );
}
