"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { applyOptimisticLeadDetailPatch } from "@/lib/query/optimistic-lead-detail";
import { parseResponseJson } from "../../lib/api/parse-response-json";
import { reviveLeadDetailFromJson } from "./lead-detail-wire";
import { leadQueryKeys } from "./lead-query-keys";
import type { LeadDetailRow } from "./queries";

async function fetchLeadDetail(leadId: string): Promise<LeadDetailRow> {
  const r = await fetch(`/api/leads/${leadId}`);
  const j = await parseResponseJson<{ lead?: unknown; error?: string }>(r);
  if (!r.ok) {
    throw new Error(j.error ?? "Не вдалося завантажити лід");
  }
  if (!j.lead) throw new Error("Некоректна відповідь API");
  return reviveLeadDetailFromJson(j.lead);
}

export function useLeadDetailQuery(leadId: string, initialData: LeadDetailRow) {
  return useQuery({
    queryKey: leadQueryKeys.detail(leadId),
    queryFn: () => fetchLeadDetail(leadId),
    initialData,
    initialDataUpdatedAt: initialData.updatedAt.getTime(),
  });
}

type PatchLeadBody = Record<string, unknown>;

export type LeadPatchSuccess = {
  ok?: boolean;
  stageTransition?: {
    warnings?: { messageUa: string }[];
    missingRequirements?: string[];
  };
  autoAdvance?: {
    applied: boolean;
    fromStageId: string | null;
    toStageId: string | null;
    warnings?: { messageUa: string }[];
    missingRequirements?: string[];
    reasonUa?: string;
  };
};

export function useLeadPatchMutation(leadId: string): UseMutationResult<
  LeadPatchSuccess,
  Error,
  PatchLeadBody,
  { previous: LeadDetailRow | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: PatchLeadBody) => {
      const r = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await parseResponseJson<{
        error?: string;
        transitionErrors?: { messageUa: string }[];
        lead?: unknown;
        stageTransition?: {
          warnings?: { messageUa: string }[];
          missingRequirements?: string[];
        };
        autoAdvance?: {
          applied: boolean;
          fromStageId: string | null;
          toStageId: string | null;
          warnings?: { messageUa: string }[];
          missingRequirements?: string[];
          reasonUa?: string;
        };
      }>(r);
      if (!r.ok) {
        const msg =
          j.transitionErrors?.length
            ? j.transitionErrors.map((e) => e.messageUa).join(" · ")
            : j.error ?? "Помилка збереження";
        throw new Error(msg);
      }
      return j as LeadPatchSuccess;
    },
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: leadQueryKeys.detail(leadId) });
      const previous = queryClient.getQueryData<LeadDetailRow>(
        leadQueryKeys.detail(leadId),
      );
      if (previous) {
        queryClient.setQueryData<LeadDetailRow>(
          leadQueryKeys.detail(leadId),
          applyOptimisticLeadDetailPatch(previous, body),
        );
      }
      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(leadQueryKeys.detail(leadId), ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: leadQueryKeys.detail(leadId),
        exact: true,
      });
    },
  });
}
