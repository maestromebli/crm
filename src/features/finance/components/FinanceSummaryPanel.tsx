import { SectionCard } from "../../../components/shared/SectionCard";
import { StatusBadge } from "../../../components/shared/StatusBadge";

type Props = {
  alerts: Array<{ level: "P0" | "P1" | "P2"; text: string }>;
};

export function FinanceSummaryPanel({ alerts }: Props) {
  return (
    <SectionCard title="Алерти / ризики" subtitle="Критичні події по фінансах">
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <div key={`${a.text}-${i}`} className="rounded border border-slate-200 p-2">
            <div className="mb-1"><StatusBadge label={a.level} tone={a.level === "P0" ? "danger" : a.level === "P1" ? "warning" : "success"} /></div>
            <p className="text-xs text-slate-700">{a.text}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

