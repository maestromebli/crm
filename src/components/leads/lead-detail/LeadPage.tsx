import { Suspense } from "react";
import type { LeadDetailRow } from "../../../features/leads/queries";
import { LeadAssistantEntityBridge } from "../../../features/ai-assistant/components/LeadAssistantEntityBridge";
import { EntitySubnav } from "../../shared/EntitySubnav";
import { LeadAiTabClient } from "../LeadAiTabClient";
import { LeadContactTabClient } from "../LeadContactTabClient";
import { LeadMessagesTabClient } from "../LeadMessagesTabClient";
import { LeadHubOverviewClient } from "../../../modules/leads/lead-hub";
import { LeadCommercialProcessStepper } from "../../../modules/leads/lead-hub/components/LeadCommercialProcessStepper";
import { LeadPricingWorkspaceClient } from "../../../modules/leads/lead-pricing";
import { PostCreateActions } from "../new-lead/PostCreateActions";
import { LeadActivity } from "./LeadActivity";
import { LeadFiles } from "./LeadFiles";
import { LeadHeader } from "./LeadHeader";
import { LeadTasks } from "./LeadTasks";

export type LeadDetailViewProps = {
  lead: LeadDetailRow;
  tab: string | null;
  canUpdateLead: boolean;
  canConvertToDeal: boolean;
  canUploadLeadFiles: boolean;
  canSearchContacts: boolean;
  canViewTasks: boolean;
  canCreateTasks: boolean;
  canUpdateTasks: boolean;
  canAssignLead: boolean;
  canViewEstimates: boolean;
  canCreateEstimate: boolean;
  canUpdateEstimate: boolean;
  canViewCost: boolean;
};

/** Картка ліда: шапка, підсумок, вкладки. */
export function LeadPage({
  lead,
  tab,
  canUpdateLead,
  canConvertToDeal,
  canUploadLeadFiles,
  canSearchContacts,
  canViewTasks,
  canCreateTasks,
  canUpdateTasks,
  canAssignLead,
  canViewEstimates,
  canCreateEstimate,
  canUpdateEstimate,
  canViewCost,
}: LeadDetailViewProps) {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const isOverview = !tab || tab === "overview";
  const contentMaxWidthClass = isOverview ? "" : "mx-auto w-full max-w-7xl";

  return (
    <LeadAssistantEntityBridge lead={lead}>
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)]">
      <div
        className={`px-3 pb-2 pt-4 md:px-6 md:pt-5 ${
          isOverview ? "" : contentMaxWidthClass
        }`}
      >
        <LeadHeader lead={lead} />
      </div>
      <EntitySubnav
        entityId={lead.id}
        kind="lead"
        leadHiddenTabIds={
          canViewEstimates ? undefined : ["pricing", "kp"]
        }
      />
      <div
        className={`flex flex-1 flex-col ${
          isOverview ? "min-h-0" : `${contentMaxWidthClass} px-3 py-4 md:px-6`
        }`}
      >
        {isOverview ? (
          <LeadHubOverviewClient
            key={lead.updatedAt.toISOString()}
            lead={lead}
            canUpdateLead={canUpdateLead}
            canConvertToDeal={canConvertToDeal}
            canUploadLeadFiles={canUploadLeadFiles}
            canAssignLead={canAssignLead}
            canViewTasks={canViewTasks}
            canViewEstimates={canViewEstimates}
            canCreateEstimate={canCreateEstimate}
            canUpdateEstimate={canUpdateEstimate}
          />
        ) : (
          <>
            <Suspense fallback={null}>
              <PostCreateActions
                leadId={lead.id}
                phone={phone}
                showSupervisorFlow={canAssignLead}
              />
            </Suspense>
            <LeadNonOverviewPanels
              tab={tab!}
              lead={lead}
              canUpdateLead={canUpdateLead}
              canUploadLeadFiles={canUploadLeadFiles}
              canSearchContacts={canSearchContacts}
              canViewTasks={canViewTasks}
              canCreateTasks={canCreateTasks}
              canUpdateTasks={canUpdateTasks}
              canViewEstimates={canViewEstimates}
              canCreateEstimate={canCreateEstimate}
              canUpdateEstimate={canUpdateEstimate}
              canViewCost={canViewCost}
            />
          </>
        )}
      </div>
    </div>
    </LeadAssistantEntityBridge>
  );
}

type NonOverviewProps = Omit<
  LeadDetailViewProps,
  "tab" | "canConvertToDeal" | "canAssignLead"
> & {
  tab: string;
};

function LeadNonOverviewPanels({
  tab,
  lead,
  canUpdateLead,
  canUploadLeadFiles,
  canSearchContacts,
  canViewTasks,
  canCreateTasks,
  canUpdateTasks,
  canViewEstimates,
  canCreateEstimate,
  canUpdateEstimate,
  canViewCost,
}: NonOverviewProps) {
  if (tab === "pricing" || tab === "kp") {
    return (
      <div className="space-y-5">
        <LeadCommercialProcessStepper
          lead={lead}
          active={tab === "kp" ? "kp" : "pricing"}
        />
        <LeadPricingWorkspaceClient
          leadId={lead.id}
          leadTitle={lead.title}
          leadConverted={!!lead.dealId}
          leadDealId={lead.dealId}
          leadImageUrlsForKp={lead.attachments
            .filter((a) => a.mimeType.startsWith("image/"))
            .sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
            )
            .map((a) => a.fileUrl)}
          initialEstimates={lead.estimates}
          initialProposals={lead.proposals}
          canView={canViewEstimates}
          canCreate={canCreateEstimate}
          canUpdate={canUpdateEstimate}
          showCostFields={canViewCost}
          scrollToSection={tab === "kp" ? "kp" : "estimate"}
        />
      </div>
    );
  }

  if (tab === "contact") {
    return (
      <div className="space-y-5">
        <LeadCommercialProcessStepper lead={lead} active="contact" />
        <LeadContactTabClient
          lead={lead}
          canUpdateLead={canUpdateLead}
          canSearchContacts={canSearchContacts}
        />
      </div>
    );
  }

  if (tab === "messages") {
    return (
      <LeadMessagesTabClient leadId={lead.id} canPost={canUpdateLead} />
    );
  }

  if (tab === "tasks") {
    return (
      <LeadTasks
        leadId={lead.id}
        canView={canViewTasks}
        canCreate={canCreateTasks}
        canUpdate={canUpdateTasks}
      />
    );
  }

  if (tab === "files") {
    return (
      <LeadFiles
        leadId={lead.id}
        attachments={lead.attachments}
        canUpload={canUploadLeadFiles}
      />
    );
  }

  if (tab === "activity") {
    return <LeadActivity leadId={lead.id} />;
  }

  if (tab === "ai") {
    return <LeadAiTabClient lead={lead} canUpdateLead={canUpdateLead} />;
  }

  return null;
}
