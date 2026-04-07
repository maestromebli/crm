export type ProductionEcosystemStage =
  | "READY_TO_LAUNCH"
  | "DOCUMENTATION"
  | "WAITING_MATERIALS"
  | "IN_PRODUCTION"
  | "ASSEMBLY"
  | "READY_FOR_INSTALLATION"
  | "INSTALLATION"
  | "COMPLETED"
  | "BLOCKERS";

export type StageLoadState = "ok" | "warn" | "critical";

export type ProductionOrderCard = {
  dealId: string;
  title: string;
  client: string;
  location: string;
  manager: string;
  productionResponsible: string;
  launchDate: string | null;
  deadline: string | null;
  installationDate: string | null;
  readinessScore: number;
  canStart: boolean;
  progressPct: number;
  riskScore: number;
  riskLabel: string;
  paymentPct: number;
  documentsStatus: "готово" | "частково" | "потрібно";
  materialsStatus: "готово" | "частково" | "потрібно";
  procurementStatus: "готово" | "частково" | "потрібно";
  installationStatus: string;
  blockers: string[];
  aiHint: string;
  nextAction: string;
  stage: ProductionEcosystemStage;
  orchestrationStatus: string | null;
  giblabStatus: string | null;
  constructorWorkspaceUrl: string | null;
  procurementRequestIds: string[];
};

export type ProductionBoardColumn = {
  stage: ProductionEcosystemStage;
  title: string;
  count: number;
  loadState: StageLoadState;
  orders: ProductionOrderCard[];
};

export type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  supplier: string;
  price: string;
  quantity: number;
  reserved: number;
  available: number;
  alert: "green" | "yellow" | "red";
};

export type ProcurementSummaryRow = {
  id: string;
  dealId: string;
  dealTitle: string;
  supplier: string;
  expectedDate: string | null;
  status: "потрібно закупити" | "замовлено" | "в дорозі" | "отримано";
  materialsCount: number;
  progressPct: number;
};

export type InstallationRow = {
  dealId: string;
  dealTitle: string;
  date: string | null;
  address: string;
  team: string;
  status: "заплановано" | "підтверджено" | "в процесі" | "завершено" | "перенесено";
  readinessBeforeInstall: number;
  notes: string | null;
};

export type CalendarEventItem = {
  id: string;
  dealId: string | null;
  title: string;
  type: "заміри" | "виробництво" | "монтаж" | "доставка" | "задача";
  startAt: string;
  endAt: string;
  status: string;
  owner: string;
};

export type ProductionAnalytics = {
  productionLoad: number;
  delayedOrders: number;
  riskOrders: number;
  warehouseCritical: number;
  procurementDelayed: number;
  upcomingInstallations: number;
};

export type ProductionEcosystemPayload = {
  generatedAt: string;
  columns: ProductionBoardColumn[];
  warehouse: WarehouseRow[];
  procurement: ProcurementSummaryRow[];
  installations: InstallationRow[];
  calendar: CalendarEventItem[];
  analytics: ProductionAnalytics;
};
