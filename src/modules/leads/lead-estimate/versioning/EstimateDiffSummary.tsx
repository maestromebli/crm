"use client";

type Props = {
  oldTotal: number | null;
  newTotal: number | null;
  bullets: string[];
};

export function EstimateDiffSummary({ oldTotal, newTotal, bullets }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-[11px] shadow-inner">
      <p className="font-bold text-slate-800">Підсумок змін</p>
      <p className="mt-1 tabular-nums text-slate-700">
        Разом:{" "}
        <span className="font-semibold">
          {oldTotal != null ? `${oldTotal.toLocaleString("uk-UA")}` : "—"}
        </span>
        {" → "}
        <span className="font-bold text-emerald-800">
          {newTotal != null ? `${newTotal.toLocaleString("uk-UA")} грн` : "—"}
        </span>
      </p>
      {bullets.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-slate-600">
          {bullets.slice(0, 8).map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-slate-500">Немає відмінностей у позиціях.</p>
      )}
    </div>
  );
}
