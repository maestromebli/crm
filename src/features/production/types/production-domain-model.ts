export type ProductionOrder = {
  id: string;
  dealId: string;
  clientName: string;
  orderName: string;
  currentStatus: string;
  readinessPercent: number;
  nextAction: string;
};

export type ConstructorAssignment = {
  id: string;
  productionOrderId: string;
  constructorUserId?: string;
  constructorName: string;
  secureAccessToken: string;
  assignedAt: string;
};

export type ConstructorSubmission = {
  id: string;
  productionOrderId: string;
  versionLabel: string;
  filesCount: number;
  comment?: string;
  markedReadyAt?: string;
};

export type ProductionTask = {
  id: string;
  productionOrderId: string;
  stage: string;
  title: string;
  status: string;
  dueAt?: string;
};

export type PurchaseTask = {
  id: string;
  productionOrderId: string;
  materialName: string;
  qty: number;
  supplier?: string;
  status: string;
};

export type MaterialReservation = {
  id: string;
  productionOrderId: string;
  materialName: string;
  qty: number;
  status: string;
};

export type InstallationTask = {
  id: string;
  productionOrderId: string;
  status: string;
  address: string;
  plannedAt?: string;
};

export type OperationsEvent = {
  id: string;
  productionOrderId: string;
  type: string;
  title: string;
  startsAt: string;
};

export type ProductionStatusLog = {
  id: string;
  productionOrderId: string;
  fromStatus: string;
  toStatus: string;
  changedAt: string;
  actorName?: string;
};

export type ProductionBlocker = {
  id: string;
  productionOrderId: string;
  code: string;
  title: string;
  resolvedAt?: string;
};
