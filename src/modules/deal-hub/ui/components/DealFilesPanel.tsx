import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealFilesPanel({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Файли" subtitle={`Останні файли: ${data.files.latest.length}`}>
      <ul className="space-y-1">
        {data.files.latest.map((file) => (
          <li key={file.id} className="text-xs text-slate-700">
            {file.fileName}
          </li>
        ))}
      </ul>
    </DealCard>
  );
}
