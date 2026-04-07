/**
 * Normalized inputs for CRM Core — no Prisma / React dependencies.
 */

import type { LeadStageKey } from "./lead-stage.types";

export type LeadContactInput = {
  phone: string | null;
  email: string | null;
  contactId: string | null;
  /** Normalized: phone ≥9 digits or email length > 3 */
  hasValidPhoneOrEmail: boolean;
};

export type LeadQualificationInput = {
  needsSummary: string | null;
  furnitureType: string | null;
  objectType: string | null;
  budgetRange: string | null;
  /** Optional address for measurement / visit (from qualification JSON if present). */
  address: string | null;
  /** Derived from calendar + qualification heuristics. */
  measurementDecision: LeadMeasurementDecision;
};

export type LeadMeasurementDecision =
  | "unknown"
  | "pending"
  | "scheduled"
  | "completed"
  | "skipped";

export type LeadEstimateInput = {
  id: string;
  status: string;
  version: number;
  totalPrice: number | null;
};

export type LeadProposalInput = {
  id: string;
  status: string;
  version: number;
  estimateId: string | null;
  sentAt: string | null;
  approvedAt: string | null;
  hasSnapshot: boolean;
};

export type LeadCommercialInput = {
  estimates: LeadEstimateInput[];
  activeEstimateId: string | null;
  proposals: LeadProposalInput[];
  activeProposalId: string | null;
  /** Latest proposal (by version), matching query order. */
  latestProposal: LeadProposalInput | null;
  /** Latest estimate (by version). */
  latestEstimate: LeadEstimateInput | null;
};

export type LeadFilesInput = {
  attachmentCount: number;
  /** Count per AttachmentCategory key. */
  categories: Partial<Record<string, number>>;
  hasMeasurementSheet: boolean;
  hasObjectPhotos: boolean;
};

export type LeadActivityInput = {
  lastActivityAt: Date | null;
  createdAt: Date;
  /** Precomputed calendar days since last activity, null if never. */
  daysSinceActivity: number | null;
};

export type LeadMeetingInput = {
  scheduledMeasurementCount: number;
  completedMeasurementCount: number;
  hasUpcomingMeasurement: boolean;
  /** Any calendar event linked (non-cancelled). */
  hasAnyScheduledEvent: boolean;
};

export type LeadCoreInput = {
  id: string;
  /** Canonical stage (resolved from DB slug). */
  stageKey: LeadStageKey;
  stageSlug: string | null;
  isFinalStage: boolean;
  finalType: string | null;
  source: string | null;
  ownerId: string | null;
  ownerAssigned: boolean;
  contact: LeadContactInput;
  qualification: LeadQualificationInput;
  commercial: LeadCommercialInput;
  files: LeadFilesInput;
  activity: LeadActivityInput;
  meetings: LeadMeetingInput;
  nextStepText: string | null;
  nextContactAt: Date | null;
  /** Lead.projectAgreed — commercial override / client confirmed. */
  projectAgreed: boolean;
  /** Already linked to a deal (converted). */
  dealId: string | null;
  /** Hours since lead creation without manager touch (SLA), if tracked. */
  hoursSinceCreatedWithoutTouch: number | null;
  /** Етап NEW: без `lastActivityAt` і перевищено SLA першого дотику (хв). */
  slaFirstTouchBreached: boolean;
};
