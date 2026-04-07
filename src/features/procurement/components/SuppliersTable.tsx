import { DataTableShell } from "../../../components/shared/DataTableShell";
import { StatusBadge } from "../../../components/shared/StatusBadge";
import type { Supplier } from "../types/models";

export function SuppliersTable({ rows }: { rows: Supplier[] }) {
  return (
    <DataTableShell columns={["Назва", "Тип", "Контакт", "Телефон", "Email", "Умови оплати", "Активний"]}>
      {rows.map((r) => (
        <tr key={r.id} className="border-t border-slate-100">
          <td className="px-3 py-2 text-slate-800">{r.name}</td>
          <td className="px-3 py-2 text-slate-700">{r.type}</td>
          <td className="px-3 py-2 text-slate-700">{r.contactPerson || "—"}</td>
          <td className="px-3 py-2 text-slate-700">{r.phone || "—"}</td>
          <td className="px-3 py-2 text-slate-700">{r.email || "—"}</td>
          <td className="px-3 py-2 text-slate-700">{r.paymentTerms || "—"}</td>
          <td className="px-3 py-2">
            <StatusBadge label={r.isActive ? "Так" : "Ні"} tone={r.isActive ? "success" : "neutral"} />
          </td>
        </tr>
      ))}
    </DataTableShell>
  );
}

