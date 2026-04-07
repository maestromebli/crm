import type { TargetCampaignStatus } from "../types";

export function TargetStatusPill({ status }: { status: TargetCampaignStatus }) {
  const map: Record<TargetCampaignStatus, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-800 border-emerald-200",
    PAUSED: "bg-amber-50 text-amber-900 border-amber-200",
    ARCHIVED: "bg-slate-100 text-slate-600 border-slate-200",
  };
  const label: Record<TargetCampaignStatus, string> = {
    ACTIVE: "Активна",
    PAUSED: "На паузі",
    ARCHIVED: "Архів",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}
