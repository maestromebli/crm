"use client";

import { useCallback } from "react";
import { useLeadPatchMutation } from "./use-lead-workspace-queries";

type LeadPatchBody = Record<string, unknown>;

export type LeadMutationActions = {
  isPending: boolean;
  patch: (body: LeadPatchBody) => Promise<void>;
  updateStage: (stageId: string) => Promise<void>;
  updateNextStep: (input: { nextStep: string | null; nextStepDate: string | null }) => Promise<void>;
  recordTouch: () => Promise<void>;
  linkContact: (contactId: string | null) => Promise<void>;
};

export function useLeadMutationActions(leadId: string): LeadMutationActions {
  const mutation = useLeadPatchMutation(leadId);

  const patch = useCallback(
    async (body: LeadPatchBody) => {
      await mutation.mutateAsync(body);
    },
    [mutation],
  );

  const updateStage = useCallback(
    async (stageId: string) => {
      await patch({ stageId });
    },
    [patch],
  );

  const updateNextStep = useCallback(
    async (input: { nextStep: string | null; nextStepDate: string | null }) => {
      await patch({
        nextStep: input.nextStep,
        nextStepDate: input.nextStepDate,
      });
    },
    [patch],
  );

  const recordTouch = useCallback(async () => {
    await patch({ recordTouch: true });
  }, [patch]);

  const linkContact = useCallback(
    async (contactId: string | null) => {
      await patch({ contactId });
    },
    [patch],
  );

  return {
    isPending: mutation.isPending,
    patch,
    updateStage,
    updateNextStep,
    recordTouch,
    linkContact,
  };
}
