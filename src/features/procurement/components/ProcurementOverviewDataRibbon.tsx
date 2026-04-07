type Props = {
  requestCount: number;
  itemCount: number;
  purchaseOrderCount: number;
  supplierCount: number;
  receiptCount: number;
};

/** Короткий зріз обсягу даних на огляді закупівель (орієнтація перед таблицями). */
export function ProcurementOverviewDataRibbon({
  requestCount,
  itemCount,
  purchaseOrderCount,
  supplierCount,
  receiptCount,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-600"
      role="status"
    >
      <span title="Кількість заявок на закупівлю в поточному зрізі">Заявок: {requestCount}</span>
      <span className="hidden sm:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Позиції плану закупівель (рядки)">Позицій: {itemCount}</span>
      <span className="hidden sm:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Замовлення постачальникам (PO)">PO: {purchaseOrderCount}</span>
      <span className="hidden md:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Довідник постачальників у зрізі">Постачальників: {supplierCount}</span>
      <span className="hidden lg:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Накладні / надходження товару">Поставок: {receiptCount}</span>
    </div>
  );
}
