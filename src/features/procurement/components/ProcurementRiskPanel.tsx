import { SectionCard } from "../../../components/shared/SectionCard";
import { StatusBadge } from "../../../components/shared/StatusBadge";

type Risk = { level: "P0" | "P1" | "P2"; text: string };

export function ProcurementRiskPanel({ risks }: { risks: Risk[] }) {
  return (
    <SectionCard title="Ризики закупівель" subtitle="Проблемні позиції та контроль бюджету">
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div key={`${r.text}-${i}`} className="rounded border border-slate-200 p-2">
            <div className="mb-1">
              <StatusBadge label={r.level} tone={r.level === "P0" ? "danger" : r.level === "P1" ? "warning" : "info"} />
            </div>
            <p className="text-xs text-slate-700">{r.text}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

