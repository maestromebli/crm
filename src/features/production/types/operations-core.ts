export type OpsRole =
  | "DIRECTOR"
  | "PRODUCTION_CHIEF"
  | "CONSTRUCTOR"
  | "PURCHASE_MANAGER"
  | "INSTALLER"
  | "SALES_MANAGER";

export type OrderStage =
  | "INTAKE"
  | "CONSTRUCTOR"
  | "APPROVAL"
  | "PURCHASE"
  | "WAREHOUSE"
  | "PRODUCTION"
  | "INSTALLATION"
  | "COMPLETED";

export type BlockerSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WarehouseReadinessStatus = "IN_STOCK" | "PARTIAL" | "TO_BUY" | "RESERVED";

export type PurchaseStatus =
  | "NEED_TO_BUY"
  | "IN_PROGRESS"
  | "ORDERED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "ISSUE";

export type ProductionStageStatus =
  | "NEW_IN_PRODUCTION"
  | "PREPARATION"
  | "CUTTING"
  | "EDGING"
  | "DRILLING"
  | "PAINTING"
  | "ASSEMBLY"
  | "PACKING"
  | "READY"
  | "DELAYED";

export type InstallationStatus =
  | "NOT_PLANNED"
  | "PLANNED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ISSUE";

export type NextActionId =
  | "ASSIGN_CONSTRUCTOR"
  | "OPEN_CONSTRUCTOR_WORKSPACE"
  | "REVIEW_DRAWINGS"
  | "SPLIT_TO_PURCHASE_AND_PRODUCTION"
  | "CONTROL_PURCHASE"
  | "MOVE_PRODUCTION_FORWARD"
  | "PLAN_INSTALLATION"
  | "CLOSE_ORDER";

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  critical?: boolean;
};

export type OpsTimelineEvent = {
  id: string;
  at: string;
  title: string;
  description?: string;
  actor?: string;
};

export type OpsBlocker = {
  id: string;
  title: string;
  description: string;
  severity: BlockerSeverity;
};

export type OpsAiInsight = {
  id: string;
  title: string;
  description: string;
  severity: BlockerSeverity;
  suggestedAction?: string;
};

export type ProductLine = {
  id: string;
  name: string;
  quantity: number;
  material?: string;
};

export type ProductionOrderOpsState = {
  orderId: string;
  dealId?: string;
  orderName: string;
  clientName: string;
  address?: string;
  stage: OrderStage;
  productionStage?: ProductionStageStatus;
  installationStatus?: InstallationStatus;
  paymentConfirmed: boolean;
  contractConfirmed: boolean;
  measurementCompleted: boolean;
  approvedCalculationExists: boolean;
  approvedFilesExist: boolean;
  commentsResolved: boolean;
  materialsReadiness: WarehouseReadinessStatus;
  constructorAssigned: boolean;
  drawingsApproved: boolean;
  splitCompleted: boolean;
  blockers: OpsBlocker[];
  timeline: OpsTimelineEvent[];
  productLines: ProductLine[];
  priority: "LOW" | "MEDIUM" | "HIGH";
  plannedInstallationAt?: string;
};

export type NextProductionAction = {
  id: NextActionId;
  label: string;
  description: string;
  disabled: boolean;
  reasonIfDisabled?: string;
};

export type ProductionStatusSnapshot = {
  currentStatus: string;
  nextAction: NextProductionAction;
  blockers: OpsBlocker[];
  readinessPercent: number;
  checklist: ChecklistItem[];
};

export type PurchaseTaskDraft = {
  materialName: string;
  code?: string;
  qty: number;
  supplier?: string;
  urgency: "LOW" | "MEDIUM" | "HIGH";
};

export type WarehouseReservationDraft = {
  materialName: string;
  qty: number;
  status: WarehouseReadinessStatus;
};

export type ProductionTaskDraft = {
  title: string;
  stage: ProductionStageStatus;
  dueAt?: string;
  assigneeRole?: OpsRole;
};

export type InstallationPreTaskDraft = {
  title: string;
  requiredBy?: string;
};

export type ProductionSplitResult = {
  purchaseRequests: PurchaseTaskDraft[];
  warehouseReservations: WarehouseReservationDraft[];
  productionTasks: ProductionTaskDraft[];
  schedulePlaceholders: Array<{ title: string; date: string }>;
  installationPreTasks: InstallationPreTaskDraft[];
};
