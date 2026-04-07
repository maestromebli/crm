"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type { EffectiveRole } from "../../lib/authz/roles";
import {
  deriveAiSummary,
  deriveNextActionLabel,
  deriveNextBestAction,
} from "../../features/deal-workspace/insights";
import {
  DEAL_WORKSPACE_TAB_GROUPS,
  DEAL_WORKSPACE_TAB_LABELS,
  isDealWorkspaceTabId,
  workspaceGroupForTab,
} from "./deal-workspace-tabs";
import { DealWorkspaceHeader } from "./DealWorkspaceHeader";
import { DealWorkspacePrimaryActions } from "./DealWorkspacePrimaryActions";
import { DealFinanceProjectLinks } from "./DealFinanceProjectLinks";
import { DealProcurementLink } from "./DealProcurementLink";
import { DealReadinessStrip } from "./DealReadinessStrip";
import { DealAssistantCards } from "./DealAssistantCards";
import { DealStageProgress } from "./DealStageProgress";
import { DealRightRail } from "./DealRightRail";
import { DealActionBar } from "./DealActionBar";
import { DealWorkspaceTabPanels } from "./DealWorkspaceTabPanels";
import { DealWorkspaceToastProvider } from "./DealWorkspaceToast";
import { DealWorkspaceCommandStrip } from "./DealWorkspaceCommandStrip";
import { DealWorkspaceExecutionBlocks } from "./DealWorkspaceExecutionBlocks";
import { cn } from "../../lib/utils";
import { ENVER_DEAL_TASKS_UPDATED_EVENT } from "../../features/ai-assistant/constants/leadTasksSync";
import type { EnverDealTasksUpdatedDetail } from "../../features/ai-assistant/constants/leadTasksSync";
import { dealQueryKeys } from "../../features/deal-workspace/deal-query-keys";
import { useAssistantPageEntitySetter } from "../../features/ai-assistant/context/AssistantPageEntityContext";
import { buildDealPageEntitySnapshot } from "../../features/ai-assistant/utils/buildAssistantPageEntitySnapshot";
import { DealAiOperationsPanel } from "../../features/ai";
import { AiV2InsightCard } from "../../features/ai-v2";
import { CRMLayout } from "../layout/CRMLayout";
import { parseResponseJson } from "../../lib/api/parse-response-json";

type Props = {
  data: DealWorkspacePayload;
  viewerRole?: EffectiveRole;
};

function estimateVisibilityForRole(
  role: EffectiveRole | undefined,
): "director" | "head" | "sales" {
  if (role === "SUPER_ADMIN" || role === "DIRECTOR") return "director";
  if (role === "HEAD_MANAGER") return "head";
  return "sales";
}

export function DealWorkspaceShell({ data, viewerRole }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const setDealEntity = useAssistantPageEntitySetter();
  const [headerEditSignal, setHeaderEditSignal] = useState(0);
  const tasksRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceQuery = useQuery({
    queryKey: dealQueryKeys.workspace(data.deal.id),
    queryFn: async (): Promise<DealWorkspacePayload> => {
      const r = await fetch(`/api/deals/${data.deal.id}/workspace`, {
        cache: "no-store",
      });
      const j = await parseResponseJson<{
        data?: DealWorkspacePayload;
        error?: string;
      }>(r);
      if (!r.ok || !j.data) {
        throw new Error(j.error ?? "Не вдалося завантажити угоду");
      }
      return j.data;
    },
    initialData: data,
  });
  const workspaceData = workspaceQuery.data ?? data;

  useEffect(() => {
    setDealEntity(buildDealPageEntitySnapshot(workspaceData));
    return () => setDealEntity(null);
  }, [workspaceData, setDealEntity]);

  useEffect(() => {
    queryClient.setQueryData(dealQueryKeys.workspace(data.deal.id), data);
  }, [data, queryClient]);

  useEffect(() => {
    const dealId = workspaceData.deal.id;
    const onDealTasksUpdated = (ev: Event) => {
      const ce = ev as CustomEvent<EnverDealTasksUpdatedDetail>;
      if (ce.detail?.dealId === dealId) {
        if (tasksRefreshTimerRef.current) return;
        tasksRefreshTimerRef.current = setTimeout(() => {
          tasksRefreshTimerRef.current = null;
          void queryClient.invalidateQueries({
            queryKey: dealQueryKeys.workspace(dealId),
          });
        }, 180);
      }
    };
    window.addEventListener(
      ENVER_DEAL_TASKS_UPDATED_EVENT,
      onDealTasksUpdated as EventListener,
    );
    return () => {
      if (tasksRefreshTimerRef.current) {
        clearTimeout(tasksRefreshTimerRef.current);
        tasksRefreshTimerRef.current = null;
      }
      window.removeEventListener(
        ENVER_DEAL_TASKS_UPDATED_EVENT,
        onDealTasksUpdated as EventListener,
      );
    };
  }, [workspaceData.deal.id, queryClient]);
  const estimateVisibility = estimateVisibilityForRole(viewerRole);
  const tabParam = searchParams.get("tab") ?? undefined;
  const activeTab: DealWorkspaceTabId = isDealWorkspaceTabId(tabParam)
    ? tabParam
    : "overview";

  const activeGroup = useMemo(
    () => workspaceGroupForTab(activeTab),
    [activeTab],
  );

  const setTab = useCallback(
    (id: string) => {
      const t = isDealWorkspaceTabId(id) ? id : "overview";
      const q = new URLSearchParams(searchParams.toString());
      if (t === "overview") q.delete("tab");
      else q.set("tab", t);
      const s = q.toString();
      router.replace(
        `/deals/${workspaceData.deal.id}/workspace${s ? `?${s}` : ""}`,
        { scroll: false },
      );
    },
    [router, searchParams, workspaceData.deal.id],
  );

  const dismissFromLeadBridge = useCallback(() => {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("fromLead");
    const s = q.toString();
    router.replace(
      `/deals/${workspaceData.deal.id}/workspace${s ? `?${s}` : ""}`,
      { scroll: false },
    );
  }, [router, searchParams, workspaceData.deal.id]);

  const showLeadBridge = searchParams.get("fromLead") === "1";

  const nextBest = useMemo(() => deriveNextBestAction(workspaceData), [workspaceData]);
  const aiSummary = useMemo(() => deriveAiSummary(workspaceData), [workspaceData]);
  const nextLabel = useMemo(() => deriveNextActionLabel(workspaceData), [workspaceData]);

  const bumpHeaderEdit = useCallback(() => {
    setHeaderEditSignal((s) => s + 1);
  }, []);

  return (
    <DealWorkspaceToastProvider>
    <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)]">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-3 py-4 pb-24 md:px-6 md:py-5 md:pb-28">
        {/*
          Не робимо sticky для всього цього блоку: у хедері є розгорнута форма
          редагування + смуги — закріплена зона займала більшу частину екрана й
          перекривала контент. Хедер прокручується разом зі сторінкою.
        */}
        <div className="shrink-0 space-y-2 border-b border-slate-200 pb-2 pt-0.5">
          <DealWorkspaceHeader
            data={workspaceData}
            nextActionLabel={nextLabel}
            systemNextHint={nextBest}
            openEditSignal={headerEditSignal}
          />
          <DealWorkspacePrimaryActions
            data={workspaceData}
            onTab={setTab}
            onRequestEditHeader={bumpHeaderEdit}
          />
          <DealWorkspaceCommandStrip data={workspaceData} onTab={setTab} />
          <DealFinanceProjectLinks data={workspaceData} />
          <DealProcurementLink dealId={workspaceData.deal.id} />
          <DealReadinessStrip data={workspaceData} />
        </div>

        <DealWorkspaceExecutionBlocks data={workspaceData} onTab={setTab} />

        <DealAssistantCards
          data={workspaceData}
          onTab={setTab}
          onRequestEditHeader={bumpHeaderEdit}
        />
        <AiV2InsightCard context="deal" dealId={workspaceData.deal.id} />
        <DealAiOperationsPanel dealId={workspaceData.deal.id} />

        {showLeadBridge ? (
          <div
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/95 to-white px-3 py-2.5 text-xs text-emerald-950 shadow-sm"
            role="status"
          >
            <div className="min-w-0">
              <p className="font-semibold text-emerald-950">
                Продовження з Lead Hub
              </p>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-snug text-emerald-900/90">
                Ви не переходите в «іншу систему»: контакт, файли та прорахунки з
                ліда вже в цій угоді. Далі — ті самі принципи (наступний крок,
                комунікація, документи), з повним циклом угоди.
              </p>
              {workspaceData.leadId ? (
                <Link
                  href={`/leads/${workspaceData.leadId}`}
                  className="mt-1.5 inline-block text-[11px] font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-2 hover:decoration-emerald-600"
                >
                  Відкрити картку ліда (історія та комунікація)
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              onClick={dismissFromLeadBridge}
              className="shrink-0 rounded-lg bg-[var(--enver-card)]/90 px-2.5 py-1 text-[11px] font-medium text-emerald-900 ring-1 ring-emerald-200/80 hover:bg-[var(--enver-card)]"
            >
              Зрозуміло
            </button>
          </div>
        ) : null}
        <DealStageProgress data={workspaceData} />

        <CRMLayout
          main={
            <>
            <nav className="space-y-2 rounded-2xl border border-slate-200 bg-[var(--enver-card)]/90 p-2 shadow-sm">
              <div className="flex flex-wrap gap-1">
                {DEAL_WORKSPACE_TAB_GROUPS.map((g) => {
                  const inGroup = g.tabs.includes(activeTab);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() =>
                        setTab(inGroup ? activeTab : g.defaultTab)
                      }
                      className={cn(
                        "rounded-xl px-3 py-2 text-xs font-medium transition",
                        inGroup
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100",
                      )}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
              {activeGroup.tabs.length > 1 ? (
                <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                  {activeGroup.tabs.map((tid) => (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => setTab(tid)}
                      className={cn(
                        "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                        activeTab === tid
                          ? "bg-slate-200 text-[var(--enver-text)]"
                          : "text-slate-500 hover:bg-slate-100",
                      )}
                    >
                      {DEAL_WORKSPACE_TAB_LABELS[tid]}
                    </button>
                  ))}
                </div>
              ) : null}
            </nav>

            <DealWorkspaceTabPanels
              tab={activeTab}
              data={workspaceData}
              onTab={setTab}
              estimateVisibility={estimateVisibility}
            />
            </>
          }
          smartPanel={
            <DealRightRail
              data={workspaceData}
              nextBestAction={nextBest}
              aiSummary={aiSummary}
            />
          }
        />
      </div>

      <DealActionBar
        data={workspaceData}
        activeTab={activeTab}
        onTab={setTab}
        onRequestEditHeader={bumpHeaderEdit}
      />
    </div>
    </DealWorkspaceToastProvider>
  );
}
