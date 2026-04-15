"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useLeadDetailQuery,
  useLeadPatchMutation,
} from "../../../features/leads/use-lead-workspace-queries";
import { leadQueryKeys } from "../../../features/leads/lead-query-keys";
import type { LeadDetailRow } from "../../../features/leads/queries";
import { emitLeadWorkflowEvent } from "../../../features/event-system/lead-events";
import { deleteJson, postFormData, postJson } from "../../../lib/api/patch-json";
import { parseResponseJson } from "../../../lib/api/parse-response-json";
import { suggestAttachmentCategoryFromFile } from "../../../lib/attachments/suggest-category";
import { getStageConfig, resolveLeadStageKey } from "../../../lib/crm-core";
import {
  useLeadWorkspaceSlice,
  type LeadWorkspaceTabId,
} from "../../../stores/lead-workspace-store";
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
import { ConvertToDealModal } from "../../../components/leads/ConvertToDealModal";
import { PostCreateActions } from "../../../components/leads/new-lead/PostCreateActions";

const ALL_WORKSPACE_TABS: LeadWorkspaceTabId[] = [
  "communication",
  "files",
  "measurement",
  "calculation",
  "notes",
];

function warningsToHint(
  warnings: { messageUa: string }[] | null | undefined,
): string | null {
  if (!warnings?.length) return null;
  return warnings.map((item) => item.messageUa).join(" · ");
}

function focusTabsForStage(
  stage: LeadDetailRow["stage"],
): LeadWorkspaceTabId[] {
  const key = resolveLeadStageKey(stage.slug, {
    isFinal: stage.isFinal,
    finalType: stage.finalType,
    stageName: stage.name,
  });
  const group = getStageConfig(key).group;

  if (key === "CONTROL_MEASUREMENT") {
    return ["measurement", "communication", "notes"];
  }

  switch (group) {
    case "intake":
    case "qualification":
      return ["communication", "measurement", "notes"];
    case "site_work":
      return ["measurement", "communication", "files"];
    case "pricing":
      return ["calculation", "communication", "notes"];
    case "proposal":
      return ["calculation", "communication", "notes"];
    case "closing":
      return ["communication", "calculation", "notes"];
    case "handoff":
      return ["calculation", "files", "notes"];
    case "terminal":
      return ["communication", "notes", "files"];
    default:
      return ["communication", "notes", "files"];
  }
}

function modeForStage(
  stage: LeadDetailRow["stage"],
): "new" | "contacted" | "proposal" | "closing" | "stuck" {
  const key = resolveLeadStageKey(stage.slug, {
    isFinal: stage.isFinal,
    finalType: stage.finalType,
    stageName: stage.name,
  });
  const group = getStageConfig(key).group;
  if (group === "intake" || group === "qualification") return "new";
  if (group === "site_work" || group === "pricing") return "contacted";
  if (group === "proposal") return "proposal";
  if (group === "closing" || group === "handoff") return "closing";
  return "stuck";
}

export type LeadHubOverviewClientProps = {
  lead: LeadDetailRow;
  canUpdateLead: boolean;
  canDeleteLead: boolean;
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
  canDeleteLead,
  canConvertToDeal,
  canUploadLeadFiles,
  canAssignLead,
  canViewTasks,
  canViewEstimates,
  canCreateEstimate,
  canUpdateEstimate,
}: LeadHubOverviewClientProps) {
  const router = useRouter();
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
  const [autoStageBusy, setAutoStageBusy] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureTitle, setMeasureTitle] = useState("Замір на об'єкті");
  const [measureStart, setMeasureStart] = useState("");
  const [measureBusy, setMeasureBusy] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertBusy, setConvertBusy] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);
  const [dismissedErr, setDismissedErr] = useState(false);
  const [stageHintUa, setStageHintUa] = useState<string | null>(null);
  const [dismissedStageHint, setDismissedStageHint] = useState(false);
  const archivedStage = leadRow.pipelineStages.find((s) => s.slug === "archived");
  const canArchiveLead =
    canUpdateLead &&
    archivedStage != null &&
    leadRow.stageId !== archivedStage.id;

  const canManageCommercial = canCreateEstimate || canUpdateEstimate;
  const measurementNotRequired = (() => {
    const status = leadRow.qualification.decisionStatus?.toLowerCase() ?? "";
    return status.includes("без замір") || status.includes("skip");
  })();
  const focusTabs = focusTabsForStage(leadRow.stage);
  const leadMode = modeForStage(leadRow.stage);
  const visibleTabs = ALL_WORKSPACE_TABS;
  const transitionTabs: LeadWorkspaceTabId[] = [
    ...focusTabs,
    ...ALL_WORKSPACE_TABS.filter((tab) => !focusTabs.includes(tab)),
  ];

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

  useEffect(() => {
    if (!visibleTabs.includes(slice.activeTab)) {
      setActiveTab(visibleTabs[0] ?? "communication");
    }
  }, [setActiveTab, slice.activeTab, visibleTabs]);

  useEffect(() => {
    if (slice.activeTab === "quote") {
      setActiveTab("calculation");
    }
  }, [setActiveTab, slice.activeTab]);

  const emitStageChanged = useCallback(
    (stageId: string) => {
      emitLeadWorkflowEvent("lead.stage.changed", {
        leadId: leadRow.id,
        stageId,
      });
      setLastEvent("lead.stage.changed");
    },
    [leadRow.id, setLastEvent],
  );

  const saveQuickStage = async (nextId: string) => {
    if (!canUpdateLead || nextId === leadRow.stageId || stageBusy || autoStageBusy) {
      return;
    }
    setQErr(null);
    setStageHintUa(null);
    try {
      const j = await patchMutation.mutateAsync({ stageId: nextId });
      setQuickStageId(nextId);
      setStageHintUa(warningsToHint(j.stageTransition?.warnings));
      emitStageChanged(nextId);
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Помилка");
      setQuickStageId(leadRow.stageId);
    }
  };

  const runAutoStage = async () => {
    if (!canUpdateLead || autoStageBusy) return;
    setQErr(null);
    setStageHintUa(null);
    setAutoStageBusy(true);
    try {
      const j = await patchMutation.mutateAsync({ autoAdvance: true });
      const autoResult = j.autoAdvance;
      const warningHint = warningsToHint(autoResult?.warnings);
      if (warningHint) {
        setStageHintUa(warningHint);
      } else if (autoResult && !autoResult.applied) {
        setStageHintUa(
          autoResult.reasonUa ??
            "Наразі немає підстав для автоматичного переходу на наступний етап.",
        );
      }
      if (autoResult?.applied) {
        const nextStageId = autoResult.toStageId ?? leadRow.stageId;
        setQuickStageId(nextStageId);
        emitStageChanged(nextStageId);
      }
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Не вдалося виконати автоетап");
    } finally {
      setAutoStageBusy(false);
    }
  };

  const archiveLead = async () => {
    if (!archivedStage) return;
    await saveQuickStage(archivedStage.id);
  };

  const deleteLead = async () => {
    if (!canDeleteLead || deletingLead) return;
    const confirmed = window.confirm(
      "Видалити цей лід? Дію неможливо скасувати.",
    );
    if (!confirmed) return;
    setQErr(null);
    setDeletingLead(true);
    try {
      await deleteJson<{ ok?: boolean; error?: string }>(`/api/leads/${leadRow.id}`);
      router.push("/leads");
      router.refresh();
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Не вдалося видалити лід");
    } finally {
      setDeletingLead(false);
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
      setLastEvent("lead.measurement.scheduled");
      await queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadRow.id),
      });
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setMeasureBusy(false);
    }
  };

  const markMeasurementNotRequired = async () => {
    if (!canUpdateLead || stageBusy || autoStageBusy || measurementNotRequired) return;
    setQErr(null);
    try {
      await patchMutation.mutateAsync({
        qualification: {
          ...leadRow.qualification,
          decisionStatus: "без заміру",
        },
      });
      setLastEvent("lead.measurement.skipped");
      setActiveTab("calculation");
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Не вдалося зберегти рішення щодо заміру");
    }
  };

  const tabPanels = {
    communication: (
      <div className="space-y-5">
        <span id="lead-communication" className="sr-only" />
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
          onScheduleMeasure={() => openMeasureModal()}
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
      <div className="space-y-5">
        <span id="lead-pricing" className="sr-only" />
        <span id="lead-commercial" className="sr-only" />
        <LeadHubEstimateSection
          lead={leadRow}
          canViewEstimates={canViewEstimates}
        />
        <LeadHubQuoteSection
          lead={leadRow}
          canManageEstimates={canManageCommercial}
        />
      </div>
    ),
    quote: (
      <div className="space-y-5">
        <span id="lead-pricing" className="sr-only" />
        <span id="lead-commercial" className="sr-only" />
        <LeadHubEstimateSection
          lead={leadRow}
          canViewEstimates={canViewEstimates}
        />
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
        <LeadMeetingsCard
          lead={leadRow}
          onSchedule={() => openMeasureModal()}
          canUpdateLead={canUpdateLead}
          measurementNotRequired={measurementNotRequired}
          onMarkMeasurementNotRequired={() => void markMeasurementNotRequired()}
          markingMeasurementNotRequired={stageBusy}
        />
      </div>
    ),
  };

  const centerColumn = (
    <div id="lead-hub" className="space-y-5">
      <div className="sr-only" aria-hidden>
        <div id="lead-readiness" />
        <div id="lead-contact" />
      </div>

      <div className="px-1">
        <PostCreateActions
          leadId={leadRow.id}
          phone={phone}
          showSupervisorFlow={canAssignLead}
        />
      </div>

      <div
        className="sticky top-14 z-20 -mx-4 border-b border-[var(--enver-border)]/60 bg-[var(--enver-bg)]/90 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6 supports-[backdrop-filter]:bg-[var(--enver-bg)]/72"
      >
        <LeadHubClientHeader
          lead={leadRow}
          quickStageId={quickStageId}
          stageBusy={stageBusy}
          autoStageBusy={autoStageBusy}
          canUpdateLead={canUpdateLead}
          canAutoAdvanceStage={canUpdateLead}
          onStageChange={(id) => void saveQuickStage(id)}
          onAutoAdvanceStage={() => void runAutoStage()}
          primaryCta={
            <LeadHubNextStepBanner
              lead={leadRow}
              placement="header"
              pulseEventAt={slice.lastEvent?.at ?? null}
            />
          }
          quickActions={
            <LeadHubHeaderQuickActions
              leadId={leadRow.id}
              phone={phone}
              mode={leadMode}
              canConvertToDeal={canConvertToDeal && !leadRow.linkedDeal}
              convertingToDeal={convertBusy}
              canUploadLeadFiles={canUploadLeadFiles}
              canDeleteLead={canDeleteLead}
              deletingLead={deletingLead}
              canArchiveLead={canArchiveLead}
              archiving={stageBusy}
              onUploadClick={() => fileRef.current?.click()}
              onScheduleMeasure={() => openMeasureModal()}
              onFocusNotesTab={() => setActiveTab("notes")}
              onConvertToDeal={() => setConvertOpen(true)}
              onDeleteLead={() => void deleteLead()}
              onArchiveLead={() => void archiveLead()}
            />
          }
        />
      </div>

      {qErr && !dismissedErr ? (
        <div className="flex items-start gap-2 rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-900">
          <p className="min-w-0 flex-1">{qErr}</p>
          <button
            type="button"
            className="shrink-0 rounded-[12px] px-2 py-1 text-[11px] font-medium text-rose-800 transition duration-200 hover:bg-rose-100"
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
            className="shrink-0 rounded-[12px] px-2 py-1 text-[11px] font-medium text-amber-900 transition duration-200 hover:bg-amber-100"
            onClick={() => setDismissedStageHint(true)}
          >
            Закрити
          </button>
        </div>
      ) : null}

      <div className="flex justify-end">
        <p className="text-[11px] text-[var(--enver-muted)]">
          Cmd/Ctrl + K - палітра команд
        </p>
      </div>

      <LeadHubWorkspaceTabs
        activeTab={slice.activeTab}
        onTabChange={setActiveTab}
        panels={tabPanels}
        visibleTabs={visibleTabs}
        transitionTabs={transitionTabs}
      />

      <div className="lg:hidden">
        <LeadHubNextStepBanner
          lead={leadRow}
          pulseEventAt={slice.lastEvent?.at ?? null}
        />
      </div>

      <details
        id="lead-extra"
        className="group scroll-mt-24 rounded-[14px] border border-[var(--enver-border)] bg-[var(--enver-card)] shadow-[0_8px_20px_rgba(15,23,42,0.05)] open:ring-1 open:ring-[#E5E7EB]"
      >
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--enver-text)] marker:hidden [&::-webkit-details-marker]:hidden">
          Розширені поля
        </summary>
        <div className="border-t border-[var(--enver-border)] px-4 pb-5 pt-3">
          <LeadDetailOverviewClient
            key={`${leadRow.updatedAt.toISOString()}-detail`}
            lead={leadRow}
            canUpdateLead={canUpdateLead}
            canDeleteLead={canDeleteLead}
            canConvertToDeal={canConvertToDeal}
          />
        </div>
      </details>
    </div>
  );

  return (
    <>
      <LeadHubThreeColumnShell
        className="lead-hub-root lead-hub-density-comfortable lead-hub-godmode"
        left={<LeadHubFlowColumn lead={leadRow} />}
        center={centerColumn}
        right={
          <LeadHubRightPanel lead={leadRow} mode={leadMode} />
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
      <ConvertToDealModal
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        lead={leadRow}
        canConvert={canConvertToDeal}
        onBusyChange={setConvertBusy}
        onConverted={(dealId) => {
          setConvertOpen(false);
          router.push(`/deals/${dealId}/workspace?fromLead=1`);
          router.refresh();
        }}
      />
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
            className="rounded-[12px] border border-[var(--enver-border)] px-3 py-2 text-[12px] text-[var(--enver-text)] transition duration-200 hover:bg-[var(--enver-bg)]"
          >
            Скасувати
          </button>
          <button
            type="button"
            disabled={measureBusy || !measureStart}
            onClick={onSubmit}
            className="rounded-[12px] bg-[#2563EB] px-3 py-2 text-[12px] font-medium text-white transition duration-200 hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {measureBusy ? "Збереження…" : "Створити"}
          </button>
        </div>
      </div>
    </div>
  );
}
