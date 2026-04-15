import { ContractEntity } from "./types";
import { SpecificationTable } from "./SpecificationTable";

export function ContractPreview({ contract }: { contract: ContractEntity }) {
  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h2 className="text-lg font-semibold">Попередній перегляд договору</h2>
        <p className="text-sm text-slate-600">
          №{contract.contractNumber} від {new Date(contract.contractDate).toLocaleDateString("uk-UA")}
        </p>
      </div>

      <div className="grid gap-2 text-sm md:grid-cols-2">
        <p>
          <span className="text-slate-500">Покупець:</span> {contract.customer.fullName}
        </p>
        <p>
          <span className="text-slate-500">ІПН:</span> {contract.customer.taxId ?? "-"}
        </p>
        <p>
          <span className="text-slate-500">Об'єкт:</span> {contract.objectAddress ?? "-"}
        </p>
        <p>
          <span className="text-slate-500">Доставка:</span> {contract.deliveryAddress ?? "-"}
        </p>
        <p>
          <span className="text-slate-500">Сума:</span> {contract.totalAmount}
        </p>
        <p>
          <span className="text-slate-500">Аванс:</span> {contract.advanceAmount}
        </p>
      </div>

      <SpecificationTable contract={contract} />
    </section>
  );
}
