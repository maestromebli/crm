"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [err, setErr] = useState<string | null>(null);

  const createFirst = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/leads/${leadId}/estimates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = (await r.json()) as {
        error?: string;
        estimate?: { id: string };
      };
      if (!r.ok) throw new Error(j.error ?? "Помилка");
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
      <button
        type="button"
        className={`${btnPrimary} mt-8`}
        disabled={busy}
        onClick={() => void createFirst()}
      >
        {busy ? "Створення…" : "Створити перший розрахунок"}
      </button>
    </div>
  );
}
