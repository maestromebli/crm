export function InstallationResultPanel({
  remarks,
  photosCount,
}: {
  remarks: string;
  photosCount: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Результат монтажу</h3>
      <p className="mt-2 text-xs text-slate-700">{remarks || "Без зауважень."}</p>
      <p className="mt-1 text-xs text-slate-500">Фото після монтажу: {photosCount}</p>
    </section>
  );
}
