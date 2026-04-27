"use client";

type SettingsSavePanelProps = {
  saving: boolean;
  savedAt: Date | null;
  error: string | null;
  onSave: () => void;
};

export function SettingsSavePanel({
  saving,
  savedAt,
  error,
  onSave,
}: SettingsSavePanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-full bg-slate-900 px-4 py-1.5 text-[11px] font-medium text-slate-50 shadow-sm shadow-slate-900/40 disabled:opacity-60"
        >
          {saving ? "Збереження..." : "Зберегти"}
        </button>
        {savedAt ? (
          <p className="text-[11px] text-emerald-700">
            Останнє збереження: {savedAt.toLocaleString("uk-UA")}
          </p>
        ) : (
          <p className="text-[11px] text-slate-500">Зміни ще не збережені.</p>
        )}
      </div>
      {error ? <p className="mt-1 text-[11px] text-rose-700">{error}</p> : null}
    </div>
  );
}
