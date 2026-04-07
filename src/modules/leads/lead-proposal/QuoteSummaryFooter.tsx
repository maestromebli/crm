import type { QuotePrintModel } from "../../../lib/leads/lead-proposal-document";
import { KP_REFERENCE_FOOTNOTES, formatProposalMoneyUa } from "../../../lib/leads/kp-reference-layout";

type Props = {
  model: QuotePrintModel;
};

export function QuoteSummaryFooter({ model }: Props) {
  const t = model.totals;

  return (
    <>
      <div className="mt-4 space-y-2 text-sm print:mt-3">
        {t.discountAmount != null && t.discountAmount > 0 ? (
          <div className="flex justify-end gap-8">
            <span className="text-slate-600">Знижка</span>
            <span className="w-44 text-right font-medium tabular-nums">
              − {formatProposalMoneyUa(t.discountAmount)} {model.currencyLabel}
            </span>
          </div>
        ) : null}
        {t.deliveryCost != null && t.deliveryCost > 0 ? (
          <div className="flex justify-end gap-8">
            <span className="text-slate-600">Доставка</span>
            <span className="w-44 text-right font-medium tabular-nums">
              {formatProposalMoneyUa(t.deliveryCost)} {model.currencyLabel}
            </span>
          </div>
        ) : null}
        {t.installationCost != null && t.installationCost > 0 ? (
          <div className="flex justify-end gap-8">
            <span className="text-slate-600">Монтаж / установка</span>
            <span className="w-44 text-right font-medium tabular-nums">
              {formatProposalMoneyUa(t.installationCost)} {model.currencyLabel}
            </span>
          </div>
        ) : null}
      </div>

      {t.total != null ? (
        <div className="mt-3 flex justify-end border border-slate-800 bg-emerald-50/90 px-4 py-3 text-base print:bg-emerald-100/90 print:py-2.5">
          <span className="font-semibold text-slate-900">Сума, грн</span>
          <span className="ml-8 w-44 text-right text-lg font-bold tabular-nums text-slate-900 print:text-base">
            {formatProposalMoneyUa(t.total)}
          </span>
        </div>
      ) : null}

      <div className="mt-5 space-y-1.5 text-[11px] leading-relaxed text-[var(--enver-text-muted)] print:text-[10px] print:text-slate-800">
        {KP_REFERENCE_FOOTNOTES.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {model.summary?.trim() ? (
        <div className="mt-5 rounded border border-slate-600/60 bg-[var(--enver-card)] p-4 print:mt-4 print:border-slate-200 print:bg-white">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)] print:text-slate-600">
            Коментар менеджера
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--enver-text-muted)] print:text-xs print:text-slate-800">
            {model.summary.trim()}
          </p>
        </div>
      ) : null}

      <p className="mt-8 text-center text-[10px] text-slate-400 print:mt-6">
        Документ для ознайомлення. Уточнення — у менеджера компанії.
      </p>
    </>
  );
}
