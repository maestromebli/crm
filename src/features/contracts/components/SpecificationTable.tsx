import type { ContractSpecItem } from "../types";

export function SpecificationTable(props: { items: ContractSpecItem[]; total: number; currency: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Найменування</th>
            <th className="px-3 py-2 text-left">Од.</th>
            <th className="px-3 py-2 text-left">К-сть</th>
            <th className="px-3 py-2 text-left">Ціна</th>
            <th className="px-3 py-2 text-left">Сума</th>
          </tr>
        </thead>
        <tbody>
          {props.items.map((row) => (
            <tr key={`${row.lineNumber}-${row.productName}`} className="border-t border-slate-100">
              <td className="px-3 py-2">{row.lineNumber}</td>
              <td className="px-3 py-2">{row.productName}</td>
              <td className="px-3 py-2">{row.unit}</td>
              <td className="px-3 py-2">{row.quantity}</td>
              <td className="px-3 py-2">{row.unitPrice.toFixed(2)}</td>
              <td className="px-3 py-2">{row.lineTotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium">
        Разом: {props.total.toFixed(2)} {props.currency}
      </div>
    </div>
  );
}
