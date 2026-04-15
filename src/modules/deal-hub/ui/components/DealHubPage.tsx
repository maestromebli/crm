"use client";

import type { DealHubOverview } from "../../domain/deal.types";
import { useDealActions } from "../hooks/useDealActions";
import { useDealHub } from "../hooks/useDealHub";
import { useDealSections } from "../hooks/useDealSections";
import { useDealTimeline } from "../hooks/useDealTimeline";
import { DealAIInsightsPanel } from "./DealAIInsightsPanel";
import { DealActivityPanel } from "./DealActivityPanel";
import { DealClientCard } from "./DealClientCard";
import { DealCommunicationPanel } from "./DealCommunicationPanel";
import { DealContractPanel } from "./DealContractPanel";
import { DealDocumentsPanel } from "./DealDocumentsPanel";
import { DealFilesPanel } from "./DealFilesPanel";
import { DealHealthBar } from "./DealHealthBar";
import { DealHubCommandBar } from "./DealHubCommandBar";
import { DealHubHeader } from "./DealHubHeader";
import { DealHubLayout } from "./DealHubLayout";
import { DealInstallationSummary } from "./DealInstallationSummary";
import { DealLogisticsPanel } from "./DealLogisticsPanel";
import { DealMeasurementPanel } from "./DealMeasurementPanel";
import { DealMilestonesPanel } from "./DealMilestonesPanel";
import { DealNextActionsPanel } from "./DealNextActionsPanel";
import { DealOverviewCard } from "./DealOverviewCard";
import { DealPaymentSummary } from "./DealPaymentSummary";
import { DealPricingSummary } from "./DealPricingSummary";
import { DealProcurementSummary } from "./DealProcurementSummary";
import { DealProductionSummary } from "./DealProductionSummary";
import { DealRiskPanel } from "./DealRiskPanel";
import { DealSectionTabs } from "./DealSectionTabs";
import { DealStageRail } from "./DealStageRail";
import { DealTasksPanel } from "./DealTasksPanel";
import { DealTimeline } from "./DealTimeline";
import { DealConstructorPanel } from "./DealConstructorPanel";

function ActiveSection(props: { section: string; data: DealHubOverview }) {
  switch (props.section) {
    case "pricing":
      return <DealPricingSummary data={props.data} />;
    case "contract":
      return <DealContractPanel />;
    case "measurement":
      return <DealMeasurementPanel />;
    case "constructor":
      return <DealConstructorPanel />;
    case "production":
      return <DealProductionSummary data={props.data} />;
    case "procurement":
      return <DealProcurementSummary />;
    case "logistics":
      return <DealLogisticsPanel />;
    case "installation":
      return <DealInstallationSummary data={props.data} />;
    case "finance":
      return <DealPaymentSummary data={props.data} />;
    case "documents":
      return <DealDocumentsPanel />;
    case "communication":
      return <DealCommunicationPanel />;
    case "timeline":
      return <DealActivityPanel data={props.data} />;
    default:
      return <DealOverviewCard data={props.data} />;
  }
}

export function DealHubPage(props: {
  dealId: string;
  initialData?: DealHubOverview | null;
}) {
  const overviewQuery = useDealHub(props.dealId, props.initialData);
  const timelineQuery = useDealTimeline(props.dealId);
  const { runCommand, isRunning } = useDealActions(props.dealId);
  const sections = useDealSections("overview");

  const data = overviewQuery.data;
  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Завантаження центру угоди Ultra...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DealHubHeader data={data} />
      <DealHubCommandBar
        data={data}
        onRunAction={(action) => void runCommand({ action })}
        isBusy={isRunning}
      />
      <div className="grid gap-3 md:grid-cols-4">
        <DealOverviewCard data={data} />
        <DealHealthBar data={data} />
        <DealNextActionsPanel
          data={data}
          onRunAction={(action) => void runCommand({ action })}
        />
        <DealRiskPanel data={data} />
      </div>
      <DealHubLayout
        left={
          <>
            <DealStageRail data={data} />
            <DealClientCard data={data} />
            <DealPricingSummary data={data} />
            <DealPaymentSummary data={data} />
            <DealProductionSummary data={data} />
          </>
        }
        center={
          <>
            <DealSectionTabs
              sections={sections.sections}
              activeSection={sections.activeSection}
              onChange={sections.setActiveSection}
            />
            <ActiveSection section={sections.activeSection} data={data} />
            <DealTimeline items={timelineQuery.data ?? []} />
          </>
        }
        right={
          <>
            <DealMilestonesPanel data={data} />
            <DealAIInsightsPanel data={data} />
            <DealActivityPanel data={data} />
            <DealFilesPanel data={data} />
          </>
        }
      />
      <div className="hidden">
        <DealTasksPanel />
      </div>
    </div>
  );
}
