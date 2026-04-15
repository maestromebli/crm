"use client";

export function ImportWarnings({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
      <p className="text-xs font-semibold text-amber-900">Попередження</p>
      <ul className="mt-1 space-y-1 text-xs text-amber-800">
        {warnings.map((warning, idx) => (
          <li key={`${idx}-${warning.slice(0, 20)}`}>⚠ {warning}</li>
        ))}
      </ul>
    </div>
  );
}
