export function ProductionApprovalActions() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Рішення по пакету</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Підтвердити і передати далі</button>
        <button className="rounded-lg border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-900">
          Повернути на доопрацювання
        </button>
      </div>
    </section>
  );
}
