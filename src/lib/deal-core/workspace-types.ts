import type {
  AttachmentCategory,
  DealContractStatus,
  HandoffStatus,
} from "@prisma/client";

import type { DealCommercialSnapshotV1 } from "../deals/commercial-snapshot";
import type { DealControlMeasurementV1 } from "../deals/control-measurement";

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
  /** Історія змін графіку оплат (причина обовʼязкова в API перепланування). */
  paymentPlanChangeLog?: Array<{
    at: string;
    reason: string;
    userId?: string;
  }>;
  handoffPackageReady?: boolean;
  productionOrderCreated?: boolean;
  /** Legacy alias у workspaceMeta (деякі автоматизації ще читають цей прапорець). */
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
  /** Технічний чеклист перед виробництвом (окремо від executionChecklist). */
  technicalChecklist?: {
    finalDimensionsConfirmed?: boolean;
    materialsConfirmed?: boolean;
    fittingsConfirmed?: boolean;
    drawingsAttached?: boolean;
    clientApprovalsConfirmed?: boolean;
    specialNotesDocumented?: boolean;
  };
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
  | "finance"
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

export type DealDocumentType = "CONTRACT" | "SPEC";
export type DealDocumentFormat = "HTML" | "DOCX";
export type DealContractRecipientType = "CLIENT_PERSON" | "CLIENT_COMPANY";

export type DealContractDraft = {
  documentType: DealDocumentType;
  format: DealDocumentFormat;
  templateKey: string;
  recipientType: DealContractRecipientType;
  variables: Record<string, string>;
  contentHtml: string;
  contentJson?: Record<string, unknown> | null;
};

export type DealContractVersionSummary = {
  id: string;
  revision: number;
  createdAt: string;
  createdById: string | null;
  lifecycleStatus: DealContractStatus;
  documentType: DealDocumentType;
  format: DealDocumentFormat;
  templateKey: string | null;
  recipientType: DealContractRecipientType;
};

export type HandoffManifest = {
  selectedAttachmentIds: string[];
  selectedFileAssetIds: string[];
  generatedDocumentIds: string[];
  notes?: string;
};

export type DealAttachmentSummary = {
  id: string;
  fileAssetId: string | null;
  fileName: string;
  fileUrl: string;
  category: AttachmentCategory;
  version: number;
  isCurrentVersion: boolean;
  createdAt: string;
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
  /** Заморожений знімок КП (узгоджені умови). */
  commercialSnapshot: DealCommercialSnapshotV1 | null;
  /** Віхи оплати з таблиці DealPaymentMilestone (джерело правди при наявності). */
  paymentMilestones: Array<{
    id: string;
    sortOrder: number;
    label: string | null;
    amount: number | null;
    currency: string | null;
    dueAt: string | null;
    confirmedAt: string | null;
  }>;
  /** Контрольний замір (Deal.controlMeasurementJson). */
  controlMeasurement: DealControlMeasurementV1 | null;
  contract: {
    status: DealContractStatus;
    templateKey: string | null;
    version: number;
    updatedAt: string;
    signedPdfUrl: string | null;
    diiaSessionId: string | null;
    draft: DealContractDraft | null;
    versions: DealContractVersionSummary[];
  } | null;
  attachments: DealAttachmentSummary[];
  attachmentsCount: number;
  attachmentsByCategory: Record<string, number>;
  readiness: ReadinessCheck[];
  readinessAllMet: boolean;
  lastReadinessSnapshotAt: string | null;
  handoff: DealHandoffPayload & { manifest: HandoffManifest };
  productionLaunch: {
    status: "NOT_READY" | "QUEUED" | "LAUNCHING" | "LAUNCHED" | "FAILED";
    queuedAt: string | null;
    launchedAt: string | null;
    failedAt: string | null;
    error: string | null;
    /** Новий модуль: id виробничого замовлення (якщо створено). */
    productionOrderId: string | null;
  };
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
  /** Проєкти фінансів/закупівель у БД, прив’язані до цієї угоди. */
  linkedFinanceProjects: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
  }>;
  /** Чи може користувач прив’язувати/відв’язувати фінансовий проєкт (DEALS_UPDATE). */
  canManageFinanceProjectLink: boolean;
  /** Кімната зовнішнього конструктора (після запуску у виробництво). */
  constructorRoom: {
    id: string;
    status:
      | "PENDING_ASSIGNMENT"
      | "SENT_TO_CONSTRUCTOR"
      | "IN_PROGRESS"
      | "DELIVERED"
      | "REVIEWED";
    publicToken: string;
    externalConstructorLabel: string | null;
    telegramInviteUrl: string | null;
    telegramChatId: string | null;
    aiQaJson: unknown | null;
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
    dueAt: string | null;
    sentToConstructorAt: string | null;
    deliveredAt: string | null;
    reviewedAt: string | null;
    assignedUserId: string | null;
    assignedUser: { id: string; name: string | null; email: string } | null;
    messages: Array<{
      id: string;
      body: string;
      author: "INTERNAL" | "CONSTRUCTOR";
      createdAt: string;
      authorLabel: string | null;
    }>;
  } | null;
};
