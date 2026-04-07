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

  return (
    <LeadAssistantEntityBridge lead={lead}>
    <div
      className={`flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)] ${
        !tab || tab === "overview" ? "" : ""
      }`}
    >
      <div
        className={`px-3 pb-2 pt-4 md:px-6 md:pt-5 ${
          !tab || tab === "overview" ? "" : "mx-auto w-full max-w-7xl"
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
          !tab || tab === "overview"
            ? "min-h-0"
            : "mx-auto w-full max-w-7xl px-3 py-4 md:px-6"
        }`}
      >
        {!tab || tab === "overview" ? (
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
            {tab === "pricing" || tab === "kp" ? (
          <div className="space-y-5">
            <LeadCommercialProcessStepper
              lead={lead}
              active={tab === "kp" ? "kp" : "pricing"}
            />
            <LeadPricingWorkspaceClient
              leadId={lead.id}
              leadTitle={lead.title}
              leadConverted={!!lead.dealId}
              initialEstimates={lead.estimates}
              initialProposals={lead.proposals}
              canView={canViewEstimates}
              canCreate={canCreateEstimate}
              canUpdate={canUpdateEstimate}
              showCostFields={canViewCost}
              scrollToSection={tab === "kp" ? "kp" : "estimate"}
            />
          </div>
        ) : tab === "contact" ? (
          <div className="space-y-5">
            <LeadCommercialProcessStepper lead={lead} active="contact" />
            <LeadContactTabClient
              lead={lead}
              canUpdateLead={canUpdateLead}
              canSearchContacts={canSearchContacts}
            />
          </div>
        ) : tab === "messages" ? (
          <LeadMessagesTabClient
            leadId={lead.id}
            canPost={canUpdateLead}
          />
        ) : tab === "tasks" ? (
          <LeadTasks
            leadId={lead.id}
            canView={canViewTasks}
            canCreate={canCreateTasks}
            canUpdate={canUpdateTasks}
          />
        ) : tab === "files" ? (
          <LeadFiles
            leadId={lead.id}
            attachments={lead.attachments}
            canUpload={canUploadLeadFiles}
          />
        ) : tab === "activity" ? (
          <LeadActivity leadId={lead.id} />
        ) : tab === "ai" ? (
          <LeadAiTabClient lead={lead} canUpdateLead={canUpdateLead} />
        ) : null}
          </>
        )}
      </div>
    </div>
    </LeadAssistantEntityBridge>
  );
}
