"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLeadDetailQuery,
  useLeadPatchMutation,
} from "../../../features/leads/use-lead-workspace-queries";
import { leadQueryKeys } from "../../../features/leads/lead-query-keys";
import type { LeadDetailRow } from "../../../features/leads/queries";
import { emitLeadWorkflowEvent } from "../../../features/event-system/lead-events";
import { postFormData, postJson } from "../../../lib/api/patch-json";
import { parseResponseJson } from "../../../lib/api/parse-response-json";
import { suggestAttachmentCategoryFromFile } from "../../../lib/attachments/suggest-category";
import { useLeadWorkspaceSlice } from "../../../stores/lead-workspace-store";
import { LeadCommunicationCard } from "./components/LeadCommunicationCard";
import { LeadFilesCard } from "./components/LeadFilesCard";
import { LeadHubClientHeader } from "./components/LeadHubClientHeader";
import { LeadHubEstimateSection } from "./components/LeadHubEstimateSection";
import { LeadHubNextStepBanner } from "./components/LeadHubNextStepBanner";
import { LeadHubFlowColumn } from "./components/LeadHubFlowColumn";
import { LeadHubHeaderQuickActions } from "./components/LeadHubHeaderQuickActions";
import { LeadHubNotesCard } from "./components/LeadHubNotesCard";
import { LeadHubQuoteSection } from "./components/LeadHubQuoteSection";
import { LeadHubRightPanel } from "./components/LeadHubRightPanel";
import { LeadHubThreeColumnShell } from "./components/LeadHubThreeColumnShell";
import { LeadMeetingsCard } from "./components/LeadMeetingsCard";
import { LeadTasksCard } from "./components/LeadTasksCard";
import { LeadHubWorkspaceTabs } from "./components/LeadHubWorkspaceTabs";
import { LeadDetailOverviewClient } from "../../../components/leads/LeadDetailOverviewClient";
import { PostCreateActions } from "../../../components/leads/new-lead/PostCreateActions";

export type LeadHubOverviewClientProps = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  canConvertToDeal: boolean;
  canUploadLeadFiles: boolean;
  canAssignLead: boolean;
  canViewTasks: boolean;
  canViewEstimates: boolean;
  canCreateEstimate: boolean;
  canUpdateEstimate: boolean;
};

export function LeadHubOverviewClient({
  lead,
  canUpdateLead,
  canConvertToDeal,
  canUploadLeadFiles,
  canAssignLead,
  canViewTasks,
  canViewEstimates,
  canCreateEstimate,
  canUpdateEstimate,
}: LeadHubOverviewClientProps) {
  const queryClient = useQueryClient();
  const { data: leadQuery } = useLeadDetailQuery(lead.id, lead);
  const leadRow = leadQuery ?? lead;
  const patchMutation = useLeadPatchMutation(lead.id);
  const stageBusy = patchMutation.isPending;

  const {
    slice,
    ensureLead,
    setActiveTab,
    setLastEvent,
  } = useLeadWorkspaceSlice(lead.id);

  const fileRef = useRef<HTMLInputElement>(null);
  const phone =
    leadRow.contact?.phone?.trim() || leadRow.phone?.trim() || null;

  const [qErr, setQErr] = useState<string | null>(null);
  const [quickStageId, setQuickStageId] = useState(leadRow.stageId);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureTitle, setMeasureTitle] = useState("Замір на об'єкті");
  const [measureStart, setMeasureStart] = useState("");
  const [measureBusy, setMeasureBusy] = useState(false);
  const [dismissedErr, setDismissedErr] = useState(false);
  const [stageHintUa, setStageHintUa] = useState<string | null>(null);
  const [dismissedStageHint, setDismissedStageHint] = useState(false);

  const canManageCommercial = canCreateEstimate || canUpdateEstimate;

  useEffect(() => {
    ensureLead(lead.id);
  }, [ensureLead, lead.id]);

  useEffect(() => {
    queryClient.setQueryData(leadQueryKeys.detail(lead.id), lead);
  }, [lead, queryClient]);

  useEffect(() => {
    setDismissedErr(false);
  }, [qErr]);

  useEffect(() => {
    setDismissedStageHint(false);
  }, [stageHintUa]);

  useEffect(() => {
    setQuickStageId(leadRow.stageId);
  }, [leadRow.stageId, leadRow.updatedAt]);

  const saveQuickStage = async (nextId: string) => {
    if (!canUpdateLead || nextId === leadRow.stageId) return;
    setQErr(null);
    setStageHintUa(null);
    try {
      const j = await patchMutation.mutateAsync({ stageId: nextId });
      setQuickStageId(nextId);
      const w = j.stageTransition?.warnings;
      setStageHintUa(
        w?.length ? w.map((x) => x.messageUa).join(" · ") : null,
      );
      emitLeadWorkflowEvent("lead.stage.changed", {
        leadId: leadRow.id,
        stageId: nextId,
      });
      setLastEvent("lead.stage.changed");
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Помилка");
      setQuickStageId(leadRow.stageId);
    }
  };

  const uploadWithSuggest = async (list: FileList | null) => {
    if (!list?.length || !canUploadLeadFiles) return;
    setQErr(null);
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list.item(i);
        if (!file) continue;
        const cat = suggestAttachmentCategoryFromFile(file.name, file.type);
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", cat);
        const j = await postFormData<{
          error?: string;
          id?: string;
        }>(`/api/leads/${leadRow.id}/attachments`, fd);
        if (j.id) {
          emitLeadWorkflowEvent("file.uploaded", {
            leadId: leadRow.id,
            attachmentId: j.id,
            category: cat,
          });
          setLastEvent("file.uploaded");
        }
      }
      if (fileRef.current) fileRef.current.value = "";
      await queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadRow.id),
      });
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Завантаження");
    }
  };

  const openMeasureModal = useCallback(() => {
    const t = new Date();
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() + 1);
    setMeasureStart(t.toISOString().slice(0, 16));
    setMeasureOpen(true);
  }, []);

  const submitMeasurement = async () => {
    if (!measureStart) return;
    const start = new Date(measureStart);
    setMeasureBusy(true);
    setQErr(null);
    try {
      await postJson<{ id?: string }>("/api/calendar/events", {
        title: measureTitle.trim() || "Замір",
        type: "MEASUREMENT",
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
        leadId: leadRow.id,
      });
      setMeasureOpen(false);
      await queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadRow.id),
      });
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setMeasureBusy(false);
    }
  };

  const tabPanels = {
    communication: (
      <div className="space-y-5">
        <span id="lead-next-action" className="sr-only" />
        <LeadCommunicationCard
          leadId={leadRow.id}
          canUpdateLead={canUpdateLead}
          lastActivityAt={leadRow.lastActivityAt}
          nextStep={leadRow.nextStep}
          nextContactAt={leadRow.nextContactAt}
          phone={phone}
          createdAt={leadRow.createdAt}
          stage={leadRow.stage}
        />
        <LeadTasksCard leadId={leadRow.id} canViewTasks={canViewTasks} />
      </div>
    ),
    files: (
      <div>
        <span id="lead-files" className="sr-only" />
        <LeadFilesCard
          lead={leadRow}
          canUploadLeadFiles={canUploadLeadFiles}
          fileInputRef={fileRef}
          onPickFiles={(list) => void uploadWithSuggest(list)}
        />
      </div>
    ),
    calculation: (
      <div>
        <span id="lead-commercial" className="sr-only" />
        <LeadHubEstimateSection
          lead={leadRow}
          canViewEstimates={canViewEstimates}
        />
      </div>
    ),
    quote: (
      <div>
        <LeadHubQuoteSection
          lead={leadRow}
          canManageEstimates={canManageCommercial}
        />
      </div>
    ),
    notes: (
      <div>
        <LeadHubNotesCard leadId={leadRow.id} canUpdateLead={canUpdateLead} />
      </div>
    ),
    measurement: (
      <div>
        <span id="lead-meetings" className="sr-only" />
        <LeadMeetingsCard lead={leadRow} onSchedule={() => openMeasureModal()} />
      </div>
    ),
  };

  const centerColumn = (
    <div id="lead-hub" className="space-y-6">
      <div className="sr-only" aria-hidden>
        <div id="lead-readiness" />
        <div id="lead-contact" />
      </div>

      <PostCreateActions
        leadId={leadRow.id}
        phone={phone}
        showSupervisorFlow={canAssignLead}
      />

      <div
        className="sticky top-0 z-30 -mx-4 border-b border-[var(--enver-border)]/70 bg-[var(--enver-bg)]/92 px-4 py-3 backdrop-blur-md md:-mx-6 md:px-6 supports-[backdrop-filter]:bg-[var(--enver-bg)]/78"
      >
        <LeadHubClientHeader
          lead={leadRow}
          quickStageId={quickStageId}
          stageBusy={stageBusy}
          canUpdateLead={canUpdateLead}
          onStageChange={(id) => void saveQuickStage(id)}
          primaryCta={
            <LeadHubNextStepBanner lead={leadRow} placement="header" />
          }
          quickActions={
            <LeadHubHeaderQuickActions
              leadId={leadRow.id}
              phone={phone}
              canUploadLeadFiles={canUploadLeadFiles}
              onUploadClick={() => fileRef.current?.click()}
              onScheduleMeasure={() => openMeasureModal()}
              onFocusNotesTab={() => setActiveTab("notes")}
            />
          }
        />
      </div>

      {qErr && !dismissedErr ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
          <p className="min-w-0 flex-1">{qErr}</p>
          <button
            type="button"
            className="shrink-0 rounded-[12px] px-2 py-1 text-[11px] font-medium text-rose-800 hover:bg-rose-100"
            onClick={() => setDismissedErr(true)}
          >
            Закрити
          </button>
        </div>
      ) : null}

      {stageHintUa && !dismissedStageHint ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
          <p className="min-w-0 flex-1">{stageHintUa}</p>
          <button
            type="button"
            className="shrink-0 rounded-[12px] px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
            onClick={() => setDismissedStageHint(true)}
          >
            Закрити
          </button>
        </div>
      ) : null}

      <LeadHubWorkspaceTabs
        activeTab={slice.activeTab}
        onTabChange={setActiveTab}
        panels={tabPanels}
      />

      <div className="lg:hidden">
        <LeadHubNextStepBanner lead={leadRow} />
      </div>

      <details
        id="lead-extra"
        className="group scroll-mt-24 rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] shadow-[var(--enver-shadow)] open:ring-1 open:ring-[#E5E7EB]"
      >
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--enver-text)] marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="inline-flex flex-wrap items-center gap-2">
            <span className="rounded-[12px] bg-[var(--enver-surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--enver-muted)]">
              Розширено
            </span>
            <span className="text-[var(--enver-text-muted)]">
              Поля ліда, кваліфікація та конверсія
            </span>
          </span>
        </summary>
        <div className="border-t border-[var(--enver-border)] px-4 pb-5 pt-3">
          <LeadDetailOverviewClient
            key={`${leadRow.updatedAt.toISOString()}-detail`}
            lead={leadRow}
            canUpdateLead={canUpdateLead}
            canConvertToDeal={canConvertToDeal}
          />
        </div>
      </details>
    </div>
  );

  return (
    <>
      <LeadHubThreeColumnShell
        left={<LeadHubFlowColumn lead={leadRow} />}
        center={centerColumn}
        right={
          <LeadHubRightPanel
            lead={leadRow}
            quickActions={
              <LeadHubHeaderQuickActions
                leadId={leadRow.id}
                phone={phone}
                canUploadLeadFiles={canUploadLeadFiles}
                onUploadClick={() => fileRef.current?.click()}
                onScheduleMeasure={() => openMeasureModal()}
                onFocusNotesTab={() => setActiveTab("notes")}
                className="justify-start"
              />
            }
          />
        }
      />

      {measureOpen ? (
        <LeadHubMeasurementDialog
          measureTitle={measureTitle}
          measureStart={measureStart}
          measureBusy={measureBusy}
          onTitleChange={setMeasureTitle}
          onStartChange={setMeasureStart}
          onClose={() => setMeasureOpen(false)}
          onSubmit={() => void submitMeasurement()}
        />
      ) : null}
    </>
  );
}

function LeadHubMeasurementDialog({
  measureTitle,
  measureStart,
  measureBusy,
  onTitleChange,
  onStartChange,
  onClose,
  onSubmit,
}: {
  measureTitle: string;
  measureStart: string;
  measureBusy: boolean;
  onTitleChange: (v: string) => void;
  onStartChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-[12px] border border-[var(--enver-border)] bg-[var(--enver-card)] p-5 shadow-[var(--enver-shadow)]">
        <h3 className="text-[14px] font-semibold text-[var(--enver-text)]">
          Замір у календарі
        </h3>
        <label className="mt-3 block text-[12px]">
          <span className="text-[var(--enver-muted)]">Назва</span>
          <input
            value={measureTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="mt-1 w-full rounded-[12px] border border-[var(--enver-border)] px-2 py-1.5 text-[14px] outline-none focus:border-[#2563EB]"
          />
        </label>
        <label className="mt-2 block text-[12px]">
          <span className="text-[var(--enver-muted)]">Початок</span>
          <input
            type="datetime-local"
            value={measureStart}
            onChange={(e) => onStartChange(e.target.value)}
            className="mt-1 w-full rounded-[12px] border border-[var(--enver-border)] px-2 py-1.5 text-[14px] outline-none focus:border-[#2563EB]"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border border-[var(--enver-border)] px-3 py-2 text-[12px] text-[var(--enver-text)] hover:bg-[var(--enver-bg)]"
          >
            Скасувати
          </button>
          <button
            type="button"
            disabled={measureBusy || !measureStart}
            onClick={onSubmit}
            className="rounded-[12px] bg-[#2563EB] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {measureBusy ? "Збереження…" : "Створити"}
          </button>
        </div>
      </div>
    </div>
  );
}
