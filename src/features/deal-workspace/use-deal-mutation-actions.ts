"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { parseResponseJson } from "@/lib/api/parse-response-json";
import { postJson } from "@/lib/api/patch-json";
import { dealQueryKeys } from "./deal-query-keys";
import {
  useDealStageMutation,
  useDealStatusMutation,
} from "./use-deal-workspace-mutations";
import type { DealWorkspaceMeta } from "./types";

type DealStatus = "WON" | "LOST" | "OPEN" | "ON_HOLD";

type NextStageResult = {
  blockers?: string[];
  message?: string;
};

export type FinancialWorkflowStep = {
  key: "recalc_estimate" | "sync_deal_value" | "create_doc" | "advance_stage" | "notify";
  status: "success" | "failed" | "skipped";
  message: string;
  details?: Record<string, unknown>;
};

export type FinancialWorkflowResult = {
  ok: boolean;
  mode: "best-effort";
  summary: {
    success: number;
    failed: number;
    skipped: number;
  };
  steps: FinancialWorkflowStep[];
};

export type DealMutationActions = {
  isPending: boolean;
  isStagePending: boolean;
  isStatusPending: boolean;
  updateStage: (stageId: string) => Promise<{ blockers?: string[]; message?: string }>;
  updateStatus: (status: DealStatus) => Promise<void>;
  advanceToNextStage: () => Promise<NextStageResult>;
  patchDeal: (body: Record<string, unknown>) => Promise<void>;
  patchWorkspaceMeta: (patch: Partial<DealWorkspaceMeta>) => Promise<void>;
  attachFinanceProject: (projectId: string) => Promise<void>;
  unlinkFinanceProject: (projectId: string) => Promise<void>;
  runFinancialWorkflow: () => Promise<FinancialWorkflowResult>;
};

export async function patchDealById(
  dealId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`/api/deals/${dealId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await parseResponseJson<{ error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Не вдалося зберегти замовлення");
}

export async function patchDealStageById(
  dealId: string,
  stageId: string,
): Promise<{ blockers?: string[]; stageName?: string }> {
  const r = await fetch(`/api/deals/${dealId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stageId }),
  });
  const j = await parseResponseJson<{
    error?: string;
    message?: string;
    blockers?: string[];
    stageName?: string;
  }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Не вдалося змінити стадію");
  return { blockers: j.blockers, stageName: j.stageName };
}

export async function patchWorkspaceMetaByDealId(
  dealId: string,
  patch: Partial<DealWorkspaceMeta>,
): Promise<void> {
  const r = await fetch(`/api/deals/${dealId}/workspace-meta`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<{ error?: string; message?: string }>(r);
  if (!r.ok) {
    throw new Error(j.error ?? j.message ?? "Не вдалося зберегти метадані");
  }
}

export async function patchDealHandoffByDealId(
  dealId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`/api/deals/${dealId}/handoff`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<{ error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Помилка збереження");
}

export async function patchDealProductionLaunchByDealId(
  dealId: string,
  patch: Record<string, unknown>,
): Promise<{ handoffImportedFileCount?: number | null }> {
  const r = await fetch(`/api/deals/${dealId}/production-launch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<{
    error?: string;
    message?: string;
    handoffImportedFileCount?: number | null;
  }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Помилка оновлення запуску");
  return { handoffImportedFileCount: j.handoffImportedFileCount ?? null };
}

export async function patchDealContractByDealId<T>(
  dealId: string,
  patch: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`/api/deals/${dealId}/contract`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<T & { error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Не вдалося зберегти");
  return j as T;
}

export async function patchDealPaymentMilestoneByDealId(
  dealId: string,
  milestoneId: string,
  confirmed: boolean,
): Promise<void> {
  const r = await fetch(`/api/deals/${dealId}/payment-milestones`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ milestoneId, confirmed }),
  });
  const j = await parseResponseJson<{ error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Помилка");
}

export async function patchTaskById(
  taskId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const r = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<{ error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Не вдалося оновити задачу");
}

export async function patchDealConstructorRoomByDealId<T>(
  dealId: string,
  patch: Record<string, unknown>,
): Promise<T> {
  const r = await fetch(`/api/deals/${dealId}/constructor-room`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const j = await parseResponseJson<T & { error?: string; message?: string }>(r);
  if (!r.ok) throw new Error(j.error ?? j.message ?? "Не збережено");
  return j as T;
}

export function useDealMutationActions(dealId: string): DealMutationActions {
  const queryClient = useQueryClient();
  const stageMutation = useDealStageMutation(dealId);
  const statusMutation = useDealStatusMutation(dealId);

  const updateStage = useCallback(
    async (stageId: string) => {
      return stageMutation.mutateAsync({ stageId });
    },
    [stageMutation],
  );

  const updateStatus = useCallback(
    async (status: DealStatus) => {
      await statusMutation.mutateAsync({ status });
    },
    [statusMutation],
  );

  const advanceToNextStage = useCallback(async (): Promise<NextStageResult> => {
    const j = await postJson<{
      error?: string;
      blockers?: string[];
      message?: string;
    }>(`/api/deals/${dealId}/stage/next`, {});
    await queryClient.invalidateQueries({
      queryKey: dealQueryKeys.workspace(dealId),
    });
    return { blockers: j.blockers, message: j.message };
  }, [dealId, queryClient]);

  const patchDeal = useCallback(async (body: Record<string, unknown>) => {
    await patchDealById(dealId, body);
    await queryClient.invalidateQueries({
      queryKey: dealQueryKeys.workspace(dealId),
    });
  }, [dealId, queryClient]);

  const patchWorkspaceMeta = useCallback(
    async (patch: Partial<DealWorkspaceMeta>) => {
      await patchWorkspaceMetaByDealId(dealId, patch);
      await queryClient.invalidateQueries({
        queryKey: dealQueryKeys.workspace(dealId),
      });
    },
    [dealId, queryClient],
  );

  const attachFinanceProject = useCallback(
    async (projectId: string) => {
      const r = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const j = await parseResponseJson<{ error?: string; message?: string }>(r);
      if (!r.ok) {
        throw new Error(j.error ?? j.message ?? "Не вдалося прив’язати");
      }
      await queryClient.invalidateQueries({
        queryKey: dealQueryKeys.workspace(dealId),
      });
    },
    [dealId, queryClient],
  );

  const unlinkFinanceProject = useCallback(async (projectId: string) => {
    const r = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId: null }),
    });
    const j = await parseResponseJson<{ error?: string; message?: string }>(r);
    if (!r.ok) {
      throw new Error(j.error ?? j.message ?? "Не вдалося відв’язати");
    }
    await queryClient.invalidateQueries({
      queryKey: dealQueryKeys.workspace(dealId),
    });
  }, [dealId, queryClient]);

  const runFinancialWorkflow = useCallback(async () => {
    const result = await postJson<FinancialWorkflowResult>(
      `/api/deals/${dealId}/financial-workflow`,
      {},
    );
    await queryClient.invalidateQueries({
      queryKey: dealQueryKeys.workspace(dealId),
    });
    return result;
  }, [dealId, queryClient]);

  return {
    isPending: stageMutation.isPending || statusMutation.isPending,
    isStagePending: stageMutation.isPending,
    isStatusPending: statusMutation.isPending,
    updateStage,
    updateStatus,
    advanceToNextStage,
    patchDeal,
    patchWorkspaceMeta,
    attachFinanceProject,
    unlinkFinanceProject,
    runFinancialWorkflow,
  };
}
