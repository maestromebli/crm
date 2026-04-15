import { ContractEntity } from "./types";

export function SpecificationTable({ contract }: { contract: ContractEntity }) {
  const items = contract.specification?.items ?? [];
  return (
    <div className="overflow-hidden rounded-xl border bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Товар</th>
            <th className="px-3 py-2">Од.</th>
            <th className="px-3 py-2">К-сть</th>
            <th className="px-3 py-2">Ціна</th>
            <th className="px-3 py-2">Сума</th>
          </tr>
        </thead>
        <tbody>
          {items.map((line) => (
            <tr key={line.id} className="border-t">
              <td className="px-3 py-2">{line.lineNumber}</td>
              <td className="px-3 py-2">{line.productName}</td>
              <td className="px-3 py-2">{line.unit}</td>
              <td className="px-3 py-2">{line.quantity}</td>
              <td className="px-3 py-2">{line.unitPrice}</td>
              <td className="px-3 py-2">{line.lineTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t bg-slate-50 px-3 py-3 text-sm font-medium">
        Разом: {contract.specification?.total} {contract.specification?.currency}
      </div>
    </div>
  );
}
