export type ProductionFlowStatus =
  | "NEW"
  | "ACTIVE"
  | "ON_HOLD"
  | "BLOCKED"
  | "READY_FOR_PROCUREMENT_AND_WORKSHOP"
  | "IN_WORKSHOP"
  | "READY_FOR_INSTALLATION"
  | "DONE"
  | "CANCELLED";

export type ProductionStepKey =
  | "ACCEPTED_BY_CHIEF"
  | "CONSTRUCTOR_ASSIGNED"
  | "CONSTRUCTOR_IN_PROGRESS"
  | "FILES_PACKAGE_UPLOADED"
  | "FILES_VALIDATED"
  | "APPROVED_BY_CHIEF"
  | "TASKS_DISTRIBUTED";

export type ProductionStepState = "LOCKED" | "AVAILABLE" | "IN_PROGRESS" | "DONE" | "BLOCKED";
export type ProductionRiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProductionTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED" | "CANCELLED";
export type ProductionTaskType = "CONSTRUCTOR" | "PROCUREMENT" | "WORKSHOP" | "INSTALLATION";
export type ProductionApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ProductionAIInsightType = "SUMMARY" | "WARNING" | "NEXT_ACTION" | "RISK";
export type ProductionQuestionStatus = "OPEN" | "ANSWERED" | "IGNORED";
export type ProductionConstructorMode = "INTERNAL" | "OUTSOURCE";

export type CommandCenterKpi = {
  activeFlows: number;
  blockedFlows: number;
  averageReadiness: number;
  highRiskFlows: number;
  overdueFlows: number;
  readyToDistribute: number;
  /** Задачі закупівлі без статусу «доставлено». */
  procurementPending: number;
  /** Очікувана дата вже минула, поставка ще не закрита. */
  procurementOverdue: number;
};

/** Колонка Kanban з найбільшим навантаженням (оцінка вузького місця). */
export type WorkshopBottleneck = {
  stageKey: string;
  stageLabel: string;
  taskCount: number;
  totalWorkshopTasks: number;
  sharePercent: number;
};

export type ProductionCommandCenterEvent = {
  id: string;
  flowId: string;
  flowNumber: string;
  actorName: string | null;
  title: string;
  description: string | null;
  createdAt: string;
};

export type ProductionQueueItem = {
  id: string;
  number: string;
  clientName: string;
  title: string;
  currentStepKey: ProductionStepKey;
  status: ProductionFlowStatus;
  readinessPercent: number;
  riskScore: number;
  dueDate: string | null;
  blockersCount: number;
  openQuestionsCount: number;
};

export type ProductionCommandCenterView = {
  kpis: CommandCenterKpi;
  /** Найзавантаженіша стадія цеху; `null`, якщо немає задач WORKSHOP. */
  workshopBottleneck: WorkshopBottleneck | null;
  /** Останні події по потоках (журнал рішень і переходів). */
  recentEvents: ProductionCommandCenterEvent[];
  queue: ProductionQueueItem[];
  stationLoads: Array<{
    stationKey: string;
    stationLabel: string;
    loadPercent: number;
  }>;
  criticalBlockers: Array<{
    flowId: string;
    number: string;
    title: string;
    severity: ProductionRiskSeverity;
    message: string;
  }>;
  nextActions: Array<{
    flowId: string;
    number: string;
    title: string;
    description: string;
    ctaLabel: string;
  }>;
  procurement: Array<{
    id: string;
    flowId: string;
    flowNumber: string;
    title: string;
    status: "EXPECTED" | "ORDERED" | "DELIVERED";
    supplier: string | null;
    expectedDate: string | null;
    receivedDate: string | null;
  }>;
  warehouse: Array<{
    flowId: string;
    flowNumber: string;
    material: string;
    reserved: boolean;
    incoming: boolean;
  }>;
  workshopKanban: Array<{
    stageKey: "CUTTING" | "EDGING" | "DRILLING" | "ASSEMBLY" | "PAINTING" | "PACKAGING";
    stageLabel: string;
    tasks: Array<{
      id: string;
      flowId: string;
      flowNumber: string;
      title: string;
      priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
      dueDate: string | null;
      assigneeUserId: string | null;
      assigneeName: string | null;
      materialsChecklist: Array<{ id: string; label: string; done: boolean; scope?: string }>;
    }>;
  }>;
  installation: Array<{
    id: string;
    flowId: string;
    flowNumber: string;
    title: string;
    address: string | null;
    date: string | null;
    team: string | null;
    status: "PLANNED" | "IN_PROGRESS" | "DONE";
  }>;
  syncedAt: string;
};

export type ProductionOrderHubView = {
  flow: {
    id: string;
    number: string;
    title: string;
    clientName: string;
    status: ProductionFlowStatus;
    currentStepKey: ProductionStepKey;
    readinessPercent: number;
    riskScore: number;
    dueDate: string | null;
    chiefName: string | null;
    constructorName: string | null;
    constructorMode: ProductionConstructorMode | null;
    constructorWorkspaceUrl: string | null;
    telegramThreadUrl: string | null;
  };
  steps: Array<{
    key: ProductionStepKey;
    label: string;
    state: ProductionStepState;
    completedAt: string | null;
  }>;
  blockers: Array<{
    id: string;
    severity: ProductionRiskSeverity;
    title: string;
    description: string;
  }>;
  questions: Array<{
    id: string;
    authorName: string;
    source: string;
    text: string;
    status: ProductionQuestionStatus;
    createdAt: string;
  }>;
  filePackages: Array<{
    id: string;
    packageName: string;
    versionLabel: string;
    fileCount: number;
    note: string | null;
    uploadedAt: string;
    uploadedByName: string | null;
    validationPassed: boolean;
    approvalStatus: ProductionApprovalStatus | null;
  }>;
  tasks: Array<{
    id: string;
    type: ProductionTaskType;
    title: string;
    status: ProductionTaskStatus;
    assigneeName: string | null;
    dueDate: string | null;
  }>;
  insights: Array<{
    id: string;
    type: ProductionAIInsightType;
    title: string;
    description: string;
    severity: ProductionRiskSeverity | null;
    recommendedAction: string | null;
  }>;
  timeline: Array<{
    id: string;
    type: string;
    actorName: string | null;
    title: string;
    description: string | null;
    createdAt: string;
  }>;
};
