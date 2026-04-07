"use client";

import type { ReactNode } from "react";
import type { LeadDetailRow } from "../../../../features/leads/queries";
import { LeadAiOperationsPanel } from "../../../../features/ai";
import { AiV2InsightCard } from "../../../../features/ai-v2";
import { LeadReadinessBlockersCard } from "./LeadReadinessBlockersCard";
import { LeadHubSmartInsightsCard } from "./LeadHubSmartInsightsCard";
import { LeadHubTimelineStrip } from "./LeadHubTimelineStrip";
import {
  buildLeadSmartPanelContext,
  resolveLeadUiVisibilityRules,
} from "../../../../lib/dynamic-layer";
import { SmartPanelSummaryCard } from "../../../../components/dynamic/SmartPanelSummaryCard";

type Props = {
  lead: LeadDetailRow;
  /** Дзеркало швидких дій з шапки (дзвінок, нотатки, файл, замір, стрічка). */
  quickActions?: ReactNode;
};

/**
 * Смарт-панель: швидкі дії, ризики / підказки, перевірки, AI, таймлайн.
 * Головний CTA — у липкій шапці центральної колонки.
 */
export function LeadHubRightPanel({ lead, quickActions }: Props) {
  const smart = buildLeadSmartPanelContext(lead);
  const visibility = resolveLeadUiVisibilityRules(lead);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SmartPanelSummaryCard context={smart} title="Smart Panel" />
      {quickActions ? (
        <section
          className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[var(--enver-shadow)]"
          aria-label="Швидкі дії"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            Швидкі дії
          </p>
          <div className="mt-2">{quickActions}</div>
        </section>
      ) : null}
      <LeadHubSmartInsightsCard lead={lead} />
      {visibility.showMeasurementCalendar ? (
        <section className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[var(--enver-shadow)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            Умовний блок
          </p>
          <p className="mt-1 text-[11px] text-[var(--enver-text)]">
            Потрібен замір: показуємо блок календаря для планування виїзду.
          </p>
        </section>
      ) : null}
      {visibility.showPartnerPercent ? (
        <section className="rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-3 shadow-[var(--enver-shadow)]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
            Партнерський блок
          </p>
          <p className="mt-1 text-[11px] text-[var(--enver-text)]">
            Джерело «designer»: показуємо поле партнерського відсотка.
          </p>
        </section>
      ) : null}
      <LeadReadinessBlockersCard lead={lead} />
      <AiV2InsightCard context="lead" leadId={lead.id} />
      <LeadAiOperationsPanel leadId={lead.id} />
      <LeadHubTimelineStrip leadId={lead.id} />
    </div>
  );
}
