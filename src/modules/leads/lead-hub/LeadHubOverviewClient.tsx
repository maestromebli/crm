"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LeadDetailRow } from "../../../features/leads/queries";
import { parseResponseJson } from "../../../lib/api/parse-response-json";
import { suggestAttachmentCategoryFromFile } from "../../../lib/attachments/suggest-category";
import { LeadCommunicationCard } from "./components/LeadCommunicationCard";
import { LeadFilesCard } from "./components/LeadFilesCard";
import { LeadHubClientHeader } from "./components/LeadHubClientHeader";
import { LeadHubEstimateSection } from "./components/LeadHubEstimateSection";
import { LeadHubLeadsRail } from "./components/LeadHubLeadsRail";
import { LeadHubNextStepBanner } from "./components/LeadHubNextStepBanner";
import { LeadHubQuoteSection } from "./components/LeadHubQuoteSection";
import { LeadHubRightPanel } from "./components/LeadHubRightPanel";
import { LeadHubThreeColumnShell } from "./components/LeadHubThreeColumnShell";
import { LeadCommercialProcessStepper } from "./components/LeadCommercialProcessStepper";
import { LeadMeetingsCard } from "./components/LeadMeetingsCard";
import { LeadTasksCard } from "./components/LeadTasksCard";
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
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;

  const [qErr, setQErr] = useState<string | null>(null);
  const [quickStageId, setQuickStageId] = useState(lead.stageId);
  const [stageBusy, setStageBusy] = useState(false);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureTitle, setMeasureTitle] = useState("Замір на об'єкті");
  const [measureStart, setMeasureStart] = useState("");
  const [measureBusy, setMeasureBusy] = useState(false);
  const [dismissedErr, setDismissedErr] = useState(false);
  const [stageHintUa, setStageHintUa] = useState<string | null>(null);
  const [dismissedStageHint, setDismissedStageHint] = useState(false);

  const canManageCommercial = canCreateEstimate || canUpdateEstimate;

  useEffect(() => {
    setDismissedErr(false);
  }, [qErr]);

  useEffect(() => {
    setDismissedStageHint(false);
  }, [stageHintUa]);

  useEffect(() => {
    setQuickStageId(lead.stageId);
  }, [lead.stageId, lead.updatedAt]);

  const saveQuickStage = async (nextId: string) => {
    if (!canUpdateLead || nextId === lead.stageId) return;
    setStageBusy(true);
    setQErr(null);
    setStageHintUa(null);
    try {
      const r = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: nextId }),
      });
      const j = await parseResponseJson<{
        error?: string;
        transitionErrors?: { messageUa: string }[];
        stageTransition?: { warnings?: { messageUa: string }[] };
      }>(r);
      if (!r.ok) {
        const msg =
          j.transitionErrors?.length
            ? j.transitionErrors.map((e) => e.messageUa).join(" · ")
            : j.error ?? "Не вдалося змінити стадію";
        setQErr(msg);
        setQuickStageId(lead.stageId);
        return;
      }
      setQuickStageId(nextId);
      const w = j.stageTransition?.warnings;
      setStageHintUa(
        w?.length ? w.map((x) => x.messageUa).join(" · ") : null,
      );
      router.refresh();
    } finally {
      setStageBusy(false);
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
        const r = await fetch(`/api/leads/${lead.id}/attachments`, {
          method: "POST",
          body: fd,
        });
        const j = await parseResponseJson<{ error?: string }>(r);
        if (!r.ok) throw new Error(j.error ?? file.name);
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Завантаження");
    }
  };

  const openMeasureModal = useCallback(() => {
    const t = new Date();
    t.setMinutes(0, 0, 0);
    t.setHours(t.getHours() + 1);
    const end = new Date(t.getTime() + 60 * 60 * 1000);
    setMeasureStart(t.toISOString().slice(0, 16));
    setMeasureOpen(true);
  }, []);

  const submitMeasurement = async () => {
    if (!measureStart) return;
    const start = new Date(measureStart);
    setMeasureBusy(true);
    setQErr(null);
    try {
      const r = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: measureTitle.trim() || "Замір",
          type: "MEASUREMENT",
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
          leadId: lead.id,
        }),
      });
      const j = await parseResponseJson<{ error?: string }>(r);
      if (!r.ok) throw new Error(j.error ?? "Помилка");
      setMeasureOpen(false);
      router.refresh();
    } catch (e) {
      setQErr(e instanceof Error ? e.message : "Помилка");
    } finally {
      setMeasureBusy(false);
    }
  };

  const centerColumn = (
    <div id="lead-hub" className="space-y-6">
      <PostCreateActions
        leadId={lead.id}
        phone={phone}
        showSupervisorFlow={canAssignLead}
      />

      <LeadCommercialProcessStepper lead={lead} active="hub" />

      <LeadHubClientHeader
        lead={lead}
        quickStageId={quickStageId}
        stageBusy={stageBusy}
        canUpdateLead={canUpdateLead}
        onStageChange={(id) => void saveQuickStage(id)}
      />

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

      <LeadHubEstimateSection
        lead={lead}
        canViewEstimates={canViewEstimates}
      />
      <LeadHubQuoteSection
        lead={lead}
        canManageEstimates={canManageCommercial}
      />

      <LeadCommunicationCard
        leadId={lead.id}
        canUpdateLead={canUpdateLead}
        lastActivityAt={lead.lastActivityAt}
        nextStep={lead.nextStep}
        nextContactAt={lead.nextContactAt}
        phone={phone}
        createdAt={lead.createdAt}
        stage={lead.stage}
      />
      <LeadMeetingsCard lead={lead} onSchedule={() => openMeasureModal()} />
      <LeadTasksCard leadId={lead.id} canViewTasks={canViewTasks} />
      <LeadFilesCard
        lead={lead}
        canUploadLeadFiles={canUploadLeadFiles}
        fileInputRef={fileRef}
        onPickFiles={(list) => void uploadWithSuggest(list)}
      />

      <div className="lg:hidden">
        <LeadHubNextStepBanner lead={lead} />
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
            key={`${lead.updatedAt.toISOString()}-detail`}
            lead={lead}
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
        left={<LeadHubLeadsRail currentLeadId={lead.id} />}
        center={centerColumn}
        right={<LeadHubRightPanel lead={lead} />}
      />

      {measureOpen ? (
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
                onChange={(e) => setMeasureTitle(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-[var(--enver-border)] px-2 py-1.5 text-[14px] outline-none focus:border-[#2563EB]"
              />
            </label>
            <label className="mt-2 block text-[12px]">
              <span className="text-[var(--enver-muted)]">Початок</span>
              <input
                type="datetime-local"
                value={measureStart}
                onChange={(e) => setMeasureStart(e.target.value)}
                className="mt-1 w-full rounded-[12px] border border-[var(--enver-border)] px-2 py-1.5 text-[14px] outline-none focus:border-[#2563EB]"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMeasureOpen(false)}
                className="rounded-[12px] border border-[var(--enver-border)] px-3 py-2 text-[12px] text-[var(--enver-text)] hover:bg-[var(--enver-bg)]"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={measureBusy || !measureStart}
                onClick={() => void submitMeasurement()}
                className="rounded-[12px] bg-[#2563EB] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
              >
                {measureBusy ? "Збереження…" : "Створити"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
}
