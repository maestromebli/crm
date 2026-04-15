import type { DealHubOverview } from "../../domain/deal.types";
import { DealCard } from "./_shared";

export function DealPaymentSummary({ data }: { data: DealHubOverview }) {
  return (
    <DealCard title="Оплати">
      <p className="text-xs text-slate-600">Прогрес: {data.finance.paymentProgressPct ?? 0}%</p>
      <p className="text-xs text-slate-600">
        Аванс: {data.finance.depositReceived ?? 0} / {data.finance.depositRequired ?? 0}
      </p>
      <p className="text-xs text-slate-600">
        Фінальний платіж: {data.finance.finalPaymentReceived ?? 0} / {data.finance.finalPaymentRequired ?? 0}
      </p>
    </DealCard>
  );
}
