export const dealQueryKeys = {
  all: ["dealWorkspace"] as const,
  workspace: (dealId: string) => ["dealWorkspace", "workspace", dealId] as const,
  tasks: (dealId: string) => ["dealWorkspace", "tasks", dealId] as const,
};

