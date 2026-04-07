import type { DealContractStatus, HandoffStatus } from "@prisma/client";

/** Метаєдані угоди для єдиного робочого місця (JSON у `Deal.workspaceMeta`). */
export type DealWorkspaceMeta = {
  nextActionAt?: string;
  /** Конкретна дія менеджера (не плутати з subStatusLabel / статусом угоди). */
  nextStepLabel?: string;
  /** Підказка для автоматизацій і фільтрів: call | visit | send_quote | follow_up | payment | other */
  nextStepKind?:
    | "call"
    | "visit"
    | "send_quote"
    | "follow_up"
    | "payment"
    | "other";
  health?: "ok" | "at_risk" | "blocked";
  /** Під-статус для шапки (напр. «Очікує підпис клієнта»). */
  subStatusLabel?: string;
  measurementComplete?: boolean;
  proposalSent?: boolean;
  /** Кваліфікація ліда/угоди на ранньому етапі. */
  qualificationComplete?: boolean;
  qualificationNotes?: string;
  measurementNotes?: string;
  proposalNotes?: string;
  /** Нотатка по комунікаціях (до інтеграції inbox). */
  communicationsNote?: string;
  payment?: {
    milestones: Array<{
      id: string;
      label: string;
      amount?: number;
      currency?: string;
      done: boolean;
    }>;
  };
  handoffPackageReady?: boolean;
  productionOrderCreated?: boolean;
  productionLaunched?: boolean;
  /** Зв’язок з лідом після конверсії (комунікація не дублюється). */
  conversion?: {
    fromLeadId?: string;
    communicationMode?: "full" | "recent";
    communicationRecentCount?: number;
  };
  /** Чеклист виконання (угода, не продаж). */
  executionChecklist?: {
    contactConfirmed?: boolean;
    estimateApproved?: boolean;
    contractCreated?: boolean;
    contractSigned?: boolean;
    prepaymentReceived?: boolean;
    productionStarted?: boolean;
    installationScheduled?: boolean;
  };
  /** Дата монтажу (дубль з Deal.installationDate для швидкого доступу в UI). */
  installationDate?: string;
};

export type DealWorkspaceTabId =
  | "overview"
  | "messages"
  | "qualification"
  | "measurement"
  | "proposal"
  | "estimate"
  | "contract"
  | "payment"
  | "files"
  | "tasks"
  | "handoff"
  | "production"
  | "activity";

export type ReadinessCheck = {
  id: string;
  label: string;
  done: boolean;
  source: string;
  blockerMessage?: string;
};

export type DealHandoffPayload = {
  id: string;
  status: HandoffStatus;
  notes: string | null;
  manifestJson: unknown;
  submittedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

export type DealWorkspacePayload = {
  deal: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    value: number | null;
    currency: string | null;
    expectedCloseDate: string | null;
    createdAt: string;
    updatedAt: string;
  };
  client: { id: string; name: string; type: string };
  primaryContact: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
  owner: { id: string; name: string | null; email: string };
  productionManager: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  installationDate: string | null;
  pipeline: { id: string; name: string };
  stage: { id: string; name: string; slug: string; sortOrder: number };
  stages: Array<{ id: string; name: string; slug: string; sortOrder: number }>;
  leadId: string | null;
  /** Останні повідомлення ліда (історія до угоди). */
  leadMessagesPreview: Array<{
    id: string;
    body: string;
    createdAt: string;
    interactionKind: string;
  }>;
  meta: DealWorkspaceMeta;
  contract: {
    status: DealContractStatus;
    templateKey: string | null;
    version: number;
    signedPdfUrl: string | null;
    diiaSessionId: string | null;
  } | null;
  attachmentsCount: number;
  attachmentsByCategory: Record<string, number>;
  readiness: ReadinessCheck[];
  readinessAllMet: boolean;
  lastReadinessSnapshotAt: string | null;
  handoff: DealHandoffPayload;
  /** Лічильники та зрізи для шапки, огляду та ризиків (без зайвих клієнтських запитів). */
  operationalStats: {
    estimatesCount: number;
    openTasksCount: number;
    overdueOpenTasksCount: number;
    completedTasksCount: number;
    lastActivityAt: string | null;
    latestEstimate: {
      id: string;
      version: number;
      status: string;
      totalPrice: number | null;
    } | null;
  };
  /** Проєкти фінансів, прив’язані до угоди (якщо завантажено сервером). */
  linkedFinanceProjects?: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
  }>;
  canManageFinanceProjectLink?: boolean;
};
