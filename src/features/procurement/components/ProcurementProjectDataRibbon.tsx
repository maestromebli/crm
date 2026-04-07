type Props = {
  projectCode: string;
  requestCount: number;
  itemCount: number;
  purchaseOrderCount: number;
  supplierCount: number;
  receiptCount: number;
};

/** Зріз обсягу даних тільки для обраного проєкту (орієнтація перед таблицями). */
export function ProcurementProjectDataRibbon({
  projectCode,
  requestCount,
  itemCount,
  purchaseOrderCount,
  supplierCount,
  receiptCount,
}: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-[11px] text-slate-700"
      role="status"
    >
      <span className="font-medium text-indigo-950" title="Код проєкту в цьому зрізі">
        Проєкт {projectCode}
      </span>
      <span className="text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Заявки на закупівлю по цьому об’єкту">Заявок: {requestCount}</span>
      <span className="hidden sm:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Позиції плану закупівель">Позицій: {itemCount}</span>
      <span className="hidden sm:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Замовлення постачальникам (PO)">PO: {purchaseOrderCount}</span>
      <span className="hidden md:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Унікальні постачальники в позиціях та PO">Постачальників: {supplierCount}</span>
      <span className="hidden lg:inline text-slate-300" aria-hidden>
        ·
      </span>
      <span title="Накладні / надходження по проєкту">Поставок: {receiptCount}</span>
    </div>
  );
}
