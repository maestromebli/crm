export function ConstructorApprovalPanel({
  status,
  onApproveLabel = "Підтвердити креслення",
  onRejectLabel = "Повернути на доопрацювання",
}: {
  status: "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "REVISION_REQUESTED";
  onApproveLabel?: string;
  onRejectLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Статус погодження</h3>
      <p className="mt-1 text-xs text-slate-600">{status}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white">{onApproveLabel}</button>
        <button className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
          {onRejectLabel}
        </button>
      </div>
    </section>
  );
}
