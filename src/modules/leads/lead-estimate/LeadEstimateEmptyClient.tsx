"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { postFormData, postJson } from "../../../lib/api/patch-json";

const btnPrimary =
  "rounded-lg border border-blue-700 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/15 transition hover:bg-blue-700 disabled:opacity-50";

export function LeadEstimateEmptyClient({
  leadId,
  leadTitle,
}: {
  leadId: string;
  leadTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const createFirst = async () => {
    setBusy(true);
    setErr(null);
    try {
      const j = await postJson<{
        error?: string;
        estimate?: { id: string };
      }>(`/api/leads/${leadId}/estimates`, {});
      if (j.estimate?.id) {
        router.push(`/leads/${leadId}/estimate/${j.estimate.id}`);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setBusy(false);
    }
  };

  const importFromExcel = async (file: File) => {
    setExcelBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const j = await postFormData<{
        estimate?: { id: string };
      }>(`/api/leads/${leadId}/estimates/import-excel`, fd);
      if (j.estimate?.id) {
        router.push(`/leads/${leadId}/estimate/${j.estimate.id}`);
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-lg font-bold text-[var(--enver-text)]">Смета по ліду</h1>
      <p className="mt-2 text-sm text-slate-600">{leadTitle}</p>
      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        Ще немає розрахунку. Створіть перший estimate, щоб швидко підготувати
        комерційну пропозицію. Додайте позиції, матеріали та ціну — система
        збере total автоматично.
      </p>
      {err ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {err}
        </p>
      ) : null}
      <input
        ref={excelInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (!file) return;
          void importFromExcel(file);
          e.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        className={`${btnPrimary} mt-8`}
        disabled={busy}
        onClick={() => void createFirst()}
      >
        {busy ? "Створення…" : "Створити перший розрахунок"}
      </button>
      <button
        type="button"
        className={`${btnPrimary} mt-3 bg-slate-900 border-slate-900 hover:bg-slate-800`}
        disabled={excelBusy}
        onClick={() => excelInputRef.current?.click()}
      >
        {excelBusy ? "Імпорт…" : "Створити з Excel"}
      </button>
    </div>
  );
}
