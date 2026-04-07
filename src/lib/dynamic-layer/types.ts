export type DynamicEntityType = "LEAD" | "DEAL";

export type NextActionPriority = "low" | "medium" | "high";

export type DynamicNextAction = {
  label: string;
  action: string;
  priority: NextActionPriority;
};

export type SmartChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type SmartPanelContext = {
  entityType: DynamicEntityType;
  entityId: string;
  status: string;
  lastActivityAt: string | null;
  missingData: string[];
  permissions: string[];
  nextAction: DynamicNextAction | null;
  riskMeter: number;
  risks: string[];
  checklist: SmartChecklistItem[];
  aiHints: string[];
  recentEvents: Array<{
    id: string;
    label: string;
    createdAt: string;
  }>;
};
