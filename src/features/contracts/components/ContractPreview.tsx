import type { ContractViewModel } from "../types";
import { SpecificationTable } from "./SpecificationTable";

export function ContractPreview({ contract }: { contract: ContractViewModel }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Попередній перегляд</h2>
        <p className="text-sm text-slate-500">
          Договір №{contract.preview.contractNumber} від {contract.preview.contractDate}
        </p>
      </div>
      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p>Покупець: {contract.preview.customerFullName || "—"}</p>
        <p>Сума: {contract.preview.totalAmountFormatted}</p>
        <p>Аванс: {contract.preview.advanceAmount.toFixed(2)}</p>
        <p>Залишок: {contract.preview.remainingAmount.toFixed(2)}</p>
      </div>
      <SpecificationTable
        items={contract.specification.items}
        total={contract.specification.total}
        currency={contract.specification.currency}
      />
    </section>
  );
}
