import type { ContractStatus } from "../types";

const labels: Record<ContractStatus, { text: string; cls: string }> = {
  DRAFT: { text: "Чернетка", cls: "bg-slate-100 text-slate-700" },
  FILLED: { text: "Заповнено", cls: "bg-blue-100 text-blue-700" },
  UNDER_REVIEW: { text: "На перевірці", cls: "bg-amber-100 text-amber-700" },
  APPROVED: { text: "Погоджено", cls: "bg-emerald-100 text-emerald-700" },
  SENT_TO_CUSTOMER: { text: "Надіслано", cls: "bg-indigo-100 text-indigo-700" },
  VIEWED_BY_CUSTOMER: { text: "Переглянуто", cls: "bg-cyan-100 text-cyan-700" },
  CUSTOMER_SIGNING: { text: "Підписання", cls: "bg-violet-100 text-violet-700" },
  CUSTOMER_SIGNED: { text: "Клієнт підписав", cls: "bg-green-100 text-green-700" },
  FULLY_SIGNED: { text: "Повністю підписано", cls: "bg-green-200 text-green-800" },
  REJECTED: { text: "Відхилено", cls: "bg-red-100 text-red-700" },
  NEEDS_REVISION: { text: "Потрібні правки", cls: "bg-orange-100 text-orange-700" },
  ARCHIVED: { text: "Архів", cls: "bg-slate-200 text-slate-700" },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const current = labels[status];
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${current.cls}`}>{current.text}</span>;
}
