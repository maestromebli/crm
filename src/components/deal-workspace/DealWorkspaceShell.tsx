"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DealWorkspacePayload } from "../../features/deal-workspace/types";
import type { DealWorkspaceTabId } from "../../features/deal-workspace/types";
import type { EffectiveRole } from "../../lib/authz/roles";
import { isDealWorkspaceTabId } from "./deal-workspace-tabs";
import { DealWorkspaceToastProvider } from "./DealWorkspaceToast";
import { ENVER_DEAL_TASKS_UPDATED_EVENT } from "../../features/ai-assistant/constants/leadTasksSync";
import type { EnverDealTasksUpdatedDetail } from "../../features/ai-assistant/constants/leadTasksSync";
import { dealQueryKeys } from "../../features/deal-workspace/deal-query-keys";
import { useAssistantPageEntitySetter } from "../../features/ai-assistant/context/AssistantPageEntityContext";
import { buildDealPageEntitySnapshot } from "../../features/ai-assistant/utils/buildAssistantPageEntitySnapshot";
import { parseResponseJson } from "../../lib/api/parse-response-json";
import { getVisibleDealWorkspaceTabs } from "../../lib/deal-workspace-visibility";
import {
  getCriticalBlockers,
  getDealTabStateMap,
  getDealViewRole,
  getDealHealthStatus,
  getFinanceSummary,
  getManagerJourneyActions,
  getPipelineStageState,
  getPrimaryNextAction,
  getProductionReadiness,
  getSmartInsights,
  getWarnings,
  type DealViewRole,
} from "../../features/deal-workspace/deal-view-selectors";
import { DealCommandHeader } from "./DealCommandHeader";
import { DealHeroAction } from "./DealHeroAction";
import { DealCriticalBlockers } from "./DealCriticalBlockers";
import { DealPipelineBar } from "./DealPipelineBar";
import { DealFinanceCard } from "./DealFinanceCard";
import { DealWorkTabs } from "./DealWorkTabs";
import { DealModules } from "./DealModules";
import { DealBottomActions } from "./DealBottomActions";
import { DealOperationalGrid } from "./DealOperationalGrid";
import { DealDocumentsTasksCard } from "./DealDocumentsTasksCard";
import { DealProductionReadinessCard } from "./DealProductionReadinessCard";
import { DealLeadTransferCard } from "./DealLeadTransferCard";

type Props = {
  data: DealWorkspacePayload;
  viewerRole?: EffectiveRole;
  viewerPermissionKeys: string[];
  viewerRealRole?: string;
  viewerImpersonatorId?: string;
};

function estimateVisibilityForRole(
  role: EffectiveRole | undefined,
): "director" | "head" | "sales" {
  if (role === "SUPER_ADMIN" || role === "DIRECTOR") return "director";
  if (role === "HEAD_MANAGER") return "head";
  return "sales";
}

export function DealWorkspaceShell({
  data,
  viewerRole,
  viewerPermissionKeys,
  viewerRealRole,
  viewerImpersonatorId,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const setDealEntity = useAssistantPageEntitySetter();
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
        throw new Error(j.error ?? "Не вдалося завантажити замовлення");
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
  const visibleTabIds = useMemo(
    () =>
      getVisibleDealWorkspaceTabs(
        {
          permissionKeys: viewerPermissionKeys,
          realRole: viewerRealRole,
          impersonatorId: viewerImpersonatorId,
        },
        [
          "overview",
          "messages",
          "qualification",
          "measurement",
          "proposal",
          "estimate",
          "contract",
          "payment",
          "finance",
          "files",
          "tasks",
          "handoff",
          "production",
          "activity",
        ] satisfies DealWorkspaceTabId[],
      ),
    [viewerImpersonatorId, viewerPermissionKeys, viewerRealRole],
  );
  const firstVisibleTab = visibleTabIds[0] ?? "overview";
  const safeActiveTab = visibleTabIds.includes(activeTab)
    ? activeTab
    : firstVisibleTab;

  const setTab = useCallback(
    (id: DealWorkspaceTabId) => {
      const q = new URLSearchParams(searchParams.toString());
      if (id === "overview") q.delete("tab");
      else q.set("tab", id);
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
  const resolvedRole = useMemo(
    () =>
      getDealViewRole(
        {
          effectiveRole: viewerRole ?? null,
          realRole: viewerRealRole ?? null,
          roleOverride: null,
        },
        workspaceData,
      ),
    [viewerRealRole, viewerRole, workspaceData],
  );
  const [viewRole, setViewRole] = useState<DealViewRole>(resolvedRole);

  useEffect(() => {
    setViewRole(resolvedRole);
  }, [resolvedRole]);

  useEffect(() => {
    if (!visibleTabIds.includes(activeTab)) {
      setTab(safeActiveTab);
    }
  }, [activeTab, safeActiveTab, setTab, visibleTabIds]);

  const primaryAction = useMemo(
    () => getPrimaryNextAction(workspaceData, viewRole),
    [workspaceData, viewRole],
  );
  const blockers = useMemo(
    () => getCriticalBlockers(workspaceData, viewRole),
    [workspaceData, viewRole],
  );
  const стан = useMemo(
    () => getDealHealthStatus(workspaceData, viewRole),
    [workspaceData, viewRole],
  );
  const finance = useMemo(() => getFinanceSummary(workspaceData), [workspaceData]);
  const pipeline = useMemo(
    () => getPipelineStageState(workspaceData, viewRole),
    [workspaceData, viewRole],
  );
  const smartInsights = useMemo(
    () => getSmartInsights(workspaceData, viewRole),
    [workspaceData, viewRole],
  );
  const warnings = useMemo(() => getWarnings(workspaceData), [workspaceData]);
  const tabStateMap = useMemo(
    () => getDealTabStateMap(workspaceData, viewRole),
    [workspaceData, viewRole],
  );
  const managerJourneyActions = useMemo(
    () =>
      getManagerJourneyActions(workspaceData, viewRole).filter((item) =>
        visibleTabIds.includes(item.tab),
      ),
    [workspaceData, viewRole, visibleTabIds],
  );
  const productionReadiness = useMemo(
    () => getProductionReadiness(workspaceData),
    [workspaceData],
  );
  const openPrimaryAction = useCallback(() => {
    setTab(primaryAction.tab);
  }, [primaryAction.tab, setTab]);
  const openBlocker = useCallback(
    (index: number) => {
      const blocker = blockers[index];
      if (!blocker) return;
      setTab(blocker.relatedModule);
    },
    [blockers, setTab],
  );
  const openJourneyAction = useCallback(
    (tab: DealWorkspaceTabId) => {
      setTab(tab);
    },
    [setTab],
  );
  const progressLabel = `Готовність: ${productionReadiness.done}/${productionReadiness.total}`;
  const focusLabel = primaryAction.reasons[0] ?? "Оновіть наступний крок по замовленню";

  return (
    <DealWorkspaceToastProvider>
      <div className="flex min-h-[calc(100vh-56px)] flex-col bg-[var(--enver-bg)]">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-3 py-4 pb-24 md:px-6">
          <DealCommandHeader
            data={workspaceData}
            стан={стан}
            onTab={setTab}
            viewRole={viewRole}
            canSwitchRole={resolvedRole === "admin"}
            onRoleChange={setViewRole}
            progressLabel={progressLabel}
            focusLabel={focusLabel}
          />
          {showLeadBridge ? (
            <div
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-emerald-200/90 bg-emerald-50/65 px-3 py-2.5 text-xs text-emerald-950"
              role="status"
            >
              <div className="min-w-0">
                <p className="font-semibold text-emerald-950">Продовження з Lead Hub</p>
                <p className="mt-0.5 max-w-2xl text-[11px] leading-snug text-emerald-900/90">
                  Контакт, файли і попередні домовленості з ліда вже у цьому замовленні.
                </p>
                {workspaceData.leadId ? (
                  <Link
                    href={`/leads/${workspaceData.leadId}`}
                    className="mt-1.5 inline-block text-[11px] font-medium text-emerald-900 underline decoration-emerald-300 underline-offset-2 hover:decoration-emerald-600"
                  >
                    Відкрити картку ліда
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

          <DealHeroAction
            action={primaryAction}
            onAction={openPrimaryAction}
            nextActions={managerJourneyActions.filter((item) => item.tab !== primaryAction.tab)}
            onOpenAction={openJourneyAction}
          />
          <DealCriticalBlockers blockers={blockers} onOpenBlocker={openBlocker} />
          <DealPipelineBar steps={pipeline} data={workspaceData} onTab={setTab} />

          <DealOperationalGrid
            left={
              <>
              <DealWorkTabs
                activeTab={safeActiveTab}
                visibleTabIds={visibleTabIds}
                onTab={setTab}
                recommendedTab={primaryAction.tab}
                tabStateMap={tabStateMap}
                quickActions={managerJourneyActions}
              />
              <DealModules
                tab={safeActiveTab}
                data={workspaceData}
                onTab={setTab}
                estimateVisibility={estimateVisibility}
              />
              </>
            }
            right={
              <>
              <DealFinanceCard
                finance={finance}
                paymentMilestones={workspaceData.paymentMilestones}
              />
              <DealDocumentsTasksCard data={workspaceData} onTab={setTab} />
              {workspaceData.leadId ? <DealLeadTransferCard data={workspaceData} /> : null}
              <DealProductionReadinessCard
                readiness={productionReadiness}
                insights={smartInsights}
                warnings={warnings}
                data={workspaceData}
                onTab={setTab}
              />
              </>
            }
          />
        </div>

        <DealBottomActions
          primaryAction={primaryAction}
          onPrimaryAction={openPrimaryAction}
          onTab={setTab}
          allowedTabs={visibleTabIds}
        />
      </div>
    </DealWorkspaceToastProvider>
  );
}
