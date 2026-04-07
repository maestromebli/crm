/**
 * Спільні типи з пакету add-on UI (cursor_addon_ui_backend_skeleton.md),
 * узгоджені з моделями ENVER: Lead + pipeline stage, LeadEstimate, LeadProposal, тощо.
 *
 * `lead.status` у DTO = назва стадії воронки (`LeadStage.name`), не окремий enum add-on.
 * `lead.code` — штучний код для UI; у БД окремого поля коду ліда немає.
 */

import type { CommercialNextAction, CommercialWarning } from "../leads/commercial-summary";
import type { LeadHubApiResponse } from "../leads/lead-hub-api";
import type {
  ConvertReadinessBanner,
  LeadReadinessRow,
} from "../leads/lead-readiness-rows";

/** Відповідь `GET /api/leads/:id/hub-summary` (коротший агрегат). */
export type LeadHubSummaryApiResponse = {
  leadId: string;
  updatedAt: string;
  hubReadiness: {
    level: string;
    headline: string;
  };
  readinessRows: LeadReadinessRow[];
  convertBanner: ConvertReadinessBanner;
  recommendation: string;
  salesHint: string;
  commercial: {
    warnings: CommercialWarning[];
    nextActions: CommercialNextAction[];
  };
};

export type ReadinessState = "READY" | "PARTIAL" | "MISSING";

export type LeadReadiness = {
  contact: ReadinessState;
  budget: ReadinessState;
  estimate: ReadinessState;
  proposal: ReadinessState;
  nextStep: ReadinessState;
  files: ReadinessState;
  summary: string;
  suggestedAction?: string;
};

export type LeadHubDto = {
  lead: {
    id: string;
    title: string;
    code: string;
    status: string;
    source?: string | null;
    phone?: string | null;
    nextActionText?: string | null;
    nextActionAt?: string | null;
    assignedManager?: { id: string; fullName: string } | null;
    expectedValue?: string | null;
    temperature?: string | null;
    projectType?: string | null;
    objectType?: string | null;
    qualificationJson?: Record<string, unknown> | null;
  };
  readiness: LeadReadiness;
  contacts: Array<{
    id: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    isPrimary: boolean;
    messengers?: Record<string, string> | null;
  }>;
  currentEstimate?: {
    id: string;
    version: number;
    total: string;
    status: string;
    updatedAt: string;
  } | null;
  latestProposal?: {
    id: string;
    version: number;
    status: string;
    total: string;
    viewedAt?: string | null;
    sentAt?: string | null;
  } | null;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt?: string | null;
  }>;
  meetings: Array<{
    id: string;
    type: string;
    status: string;
    scheduledAt?: string | null;
    resultSummary?: string | null;
  }>;
  files: Array<{
    id: string;
    name: string;
    category?: string | null;
    createdAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    subject?: string | null;
    contentText?: string | null;
    happenedAt: string;
  }>;
  aiInsights: Array<{
    id: string;
    title: string;
    content: string;
    severity?: string | null;
  }>;
};

/** Реекспорт контракту hub-агрегатора (один JSON з бекенду). */
export type { LeadHubApiResponse };
