import { ContractStatus } from "./types";

const statusMap: Record<ContractStatus, { label: string; className: string }> = {
  DRAFT: { label: "Чернетка", className: "bg-slate-100 text-slate-700" },
  FILLED: { label: "Заповнено", className: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: { label: "На перевірці", className: "bg-amber-100 text-amber-700" },
  APPROVED: { label: "Погоджено", className: "bg-emerald-100 text-emerald-700" },
  SENT_TO_CUSTOMER: { label: "Надіслано", className: "bg-indigo-100 text-indigo-700" },
  VIEWED_BY_CUSTOMER: { label: "Переглянуто", className: "bg-cyan-100 text-cyan-700" },
  CUSTOMER_SIGNING: { label: "Підписання", className: "bg-violet-100 text-violet-700" },
  CUSTOMER_SIGNED: { label: "Клієнт підписав", className: "bg-green-100 text-green-700" },
  FULLY_SIGNED: { label: "Повністю підписано", className: "bg-green-200 text-green-800" },
  REJECTED: { label: "Відхилено", className: "bg-red-100 text-red-700" },
  NEEDS_REVISION: { label: "Потрібні правки", className: "bg-orange-100 text-orange-700" },
  ARCHIVED: { label: "Архів", className: "bg-slate-200 text-slate-700" }
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const item = statusMap[status];
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${item.className}`}>
      {item.label}
    </span>
  );
}
