"use client";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { buildLeadSmartPanelContext } from "../../../../lib/dynamic-layer";

type Props = {
  lead: LeadDetailRow;
  mode?: "new" | "contacted" | "proposal" | "closing" | "stuck";
};

/**
 * Смарт-панель: швидкі дії, ризики / підказки, перевірки, AI, таймлайн.
 * Головний CTA — у липкій шапці центральної колонки.
 */
export function LeadHubRightPanel({
  lead,
  mode = "contacted",
}: Props) {
  const smart = buildLeadSmartPanelContext(lead);
  const topRisks = smart.risks.slice(0, mode === "stuck" ? 4 : 3);
  const checklist = smart.checklist.slice(0, 6);
  const hints = smart.aiHints.slice(0, 4);

  return (
    <aside className="rounded-[10px] bg-[var(--enver-bg)]/70 px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--enver-muted)]">
        Context Panel
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--enver-text-muted)]">
        Ризики, чекліст і AI-підказки в єдиному спокійному блоці.
      </p>

      <div className="mt-3 space-y-3">
        <section>
          <p className="text-[11px] font-semibold text-[var(--enver-text)]">
            Ризики ({smart.riskMeter}%)
          </p>
          {topRisks.length ? (
            <ul className="mt-1 space-y-1">
              {topRisks.map((risk) => (
                <li key={risk} className="text-[11px] text-[var(--enver-text-muted)]">
                  • {risk}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-emerald-700">Критичних ризиків не знайдено.</p>
          )}
        </section>

        <section>
          <p className="text-[11px] font-semibold text-[var(--enver-text)]">Чекліст</p>
          <ul className="mt-1 space-y-1">
            {checklist.map((item) => (
              <li key={item.id} className="text-[11px] text-[var(--enver-text-muted)]">
                {item.done ? "✓" : "○"} {item.label}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <p className="text-[11px] font-semibold text-[var(--enver-text)]">AI insights</p>
          {hints.length ? (
            <ul className="mt-1 space-y-1">
              {hints.map((hint) => (
                <li key={hint} className="text-[11px] text-[var(--enver-text-muted)]">
                  • {hint}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[11px] text-[var(--enver-text-muted)]">Поки без нових інсайтів.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
