import type { QuotePrintModel } from "../../../lib/leads/lead-proposal-document";
import { formatProposalMoneyUa } from "../../../lib/leads/kp-reference-layout";
import { QuoteImageGrid } from "./QuoteImageGrid";
import { QuoteSummaryFooter } from "./QuoteSummaryFooter";

type Props = { model: QuotePrintModel };

function fmtQty(n: number) {
  return n.toLocaleString("uk-UA", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  });
}

/**
 * Друкований вигляд КП: преміальний бізнес-стиль, без «веб-застосунку» у print.
 */
export function QuotePrintView({ model }: Props) {
  return (
    <div className="quote-print-view mx-auto max-w-6xl rounded-2xl border border-slate-600/60 bg-[var(--enver-card)] p-6 text-[var(--enver-text)] shadow-sm print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-[var(--enver-text)] print:shadow-none">
      <header className="border-b border-slate-300 pb-4 print:pb-3">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="rounded bg-slate-950 px-3 py-2 text-center text-xs font-black tracking-[0.2em] text-white print:px-2.5 print:py-1.5 print:text-[10px]">
              ENVER
            </div>
            <div className="text-left">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 print:text-[8px]">
                Furniture Factory
              </p>
              <p className="text-[11px] text-slate-600 print:text-[10px]">
                Комерційна пропозиція
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right">
            <h1 className="text-sm font-semibold tracking-tight text-[var(--enver-text)] print:text-[13px] print:text-[var(--enver-text)]">
              {model.docTitle}
            </h1>
            <p className="mt-1 text-sm text-[var(--enver-text-muted)] print:text-xs print:text-slate-800">
              {model.objectLine}
            </p>
            {model.estimateVersion != null ? (
              <p className="mt-0.5 text-[11px] text-slate-500 print:text-[10px]">
                База: смета v{model.estimateVersion}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mt-5 overflow-x-auto print:mt-4">
        <table className="w-full min-w-[900px] border-collapse text-[12px] print:text-[11px]">
          <thead>
            <tr className="bg-[var(--enver-surface)] text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-text)] print:bg-[#e8e8e8] print:text-slate-800">
              <th className="w-9 border border-slate-600 px-1.5 py-2 text-center print:border-slate-800">
                №
              </th>
              <th className="min-w-[140px] border border-slate-600 px-1.5 py-2 text-left print:border-slate-800">
                Найменування
              </th>
              <th className="w-24 border border-slate-600 px-1.5 py-2 text-right print:border-slate-800">
                Ціна, грн
              </th>
              <th className="w-14 border border-slate-600 px-1.5 py-2 text-center print:border-slate-800">
                Кол-во
              </th>
              <th className="min-w-[200px] border border-slate-600 px-1.5 py-2 text-left print:border-slate-800">
                Опис матеріалів/комплектуючих
              </th>
              <th className="w-[200px] border border-slate-600 px-1.5 py-2 text-center print:border-slate-800">
                Візи
              </th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.no} className="align-top">
                <td className="border border-slate-600 px-1.5 py-2 text-center font-semibold text-[var(--enver-text)] print:border-slate-800 print:text-[var(--enver-text)]">
                  {row.no}
                </td>
                <td className="border border-slate-600 px-1.5 py-2 text-[var(--enver-text)] print:border-slate-800 print:text-[var(--enver-text)]">
                  {row.title}
                </td>
                <td className="border border-slate-600 px-1.5 py-2 text-right font-medium tabular-nums text-[var(--enver-text)] print:border-slate-800 print:text-[var(--enver-text)]">
                  {formatProposalMoneyUa(row.lineTotal)}
                </td>
                <td className="border border-slate-600 px-1.5 py-2 text-center tabular-nums text-[var(--enver-text)] print:border-slate-800 print:text-[var(--enver-text)]">
                  {fmtQty(row.quantity)}
                </td>
                <td className="border border-slate-600 px-1.5 py-2 text-[var(--enver-text)] print:border-slate-800 print:text-[var(--enver-text)]">
                  {row.descriptionLines.length > 0 ? (
                    <div className="space-y-0.5 text-[11px] leading-snug print:text-[10px]">
                      {row.descriptionLines.map((d, i) => (
                        <div key={i} className="text-pretty">
                          -{d}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="border border-slate-600 px-1.5 py-2 print:border-slate-800">
                  <QuoteImageGrid urls={row.imageUrls} />
                </td>
              </tr>
            ))}
            {model.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-slate-600 px-3 py-8 text-center text-slate-500 print:border-slate-800"
                >
                  Немає позицій у комерційній пропозиції
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <QuoteSummaryFooter model={model} />
    </div>
  );
}
