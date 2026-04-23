"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDealActions(dealId: string) {
  const queryClient = useQueryClient();
  const runCommand = useMutation({
    mutationFn: async (input: { action: string; payload?: Record<string, unknown> }) => {
      const response = await fetch(`/api/deals/${dealId}/command-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Command failed");
      return json;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deal-hub", "overview", dealId] }),
        queryClient.invalidateQueries({ queryKey: ["deal-hub", "стан", dealId] }),
        queryClient.invalidateQueries({ queryKey: ["deal-hub", "timeline", dealId] }),
      ]);
    },
  });
  return {
    runCommand: runCommand.mutateAsync,
    isRunning: runCommand.isPending,
  };
}
