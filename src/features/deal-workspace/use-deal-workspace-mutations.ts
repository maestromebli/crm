"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseResponseJson } from "@/lib/api/parse-response-json";
import {
  applyOptimisticDealStage,
  applyOptimisticDealStatus,
} from "@/lib/optimistic/deal-workspace";
import { dealQueryKeys } from "./deal-query-keys";
import type { DealWorkspacePayload } from "./types";

type ApiError = { error?: string; message?: string };
type StageResult = { blockers?: string[]; message?: string };

export function useDealStatusMutation(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { status: "WON" | "LOST" | "OPEN" | "ON_HOLD" },
    { previous?: DealWorkspacePayload }
  >({
    mutationFn: async ({ status }) => {
      const r = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const j = await parseResponseJson<ApiError>(r);
      if (!r.ok) throw new Error(j.error ?? j.message ?? "Помилка");
    },
    onMutate: async ({ status }) => {
      await queryClient.cancelQueries({ queryKey: dealQueryKeys.workspace(dealId) });
      const previous = queryClient.getQueryData<DealWorkspacePayload>(
        dealQueryKeys.workspace(dealId),
      );
      if (previous) {
        queryClient.setQueryData(
          dealQueryKeys.workspace(dealId),
          applyOptimisticDealStatus(previous, status),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(dealQueryKeys.workspace(dealId), ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dealQueryKeys.workspace(dealId) });
    },
  });
}

export function useDealStageMutation(dealId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    StageResult,
    Error,
    { stageId: string },
    { previous?: DealWorkspacePayload }
  >({
    mutationFn: async ({ stageId }) => {
      const r = await fetch(`/api/deals/${dealId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId }),
      });
      const j = await parseResponseJson<ApiError & StageResult>(r);
      if (!r.ok) throw new Error(j.error ?? "Не вдалося змінити стадію");
      return { blockers: j.blockers, message: j.message };
    },
    onMutate: async ({ stageId }) => {
      await queryClient.cancelQueries({ queryKey: dealQueryKeys.workspace(dealId) });
      const previous = queryClient.getQueryData<DealWorkspacePayload>(
        dealQueryKeys.workspace(dealId),
      );
      if (previous) {
        queryClient.setQueryData(
          dealQueryKeys.workspace(dealId),
          applyOptimisticDealStage(previous, stageId),
        );
      }
      return { previous };
    },
    onError: (_error, _variables, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(dealQueryKeys.workspace(dealId), ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: dealQueryKeys.workspace(dealId) });
    },
  });
}

