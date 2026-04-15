import { differenceInCalendarDays } from "date-fns";
import type { LeadDetailRow } from "../../features/leads/queries";
import { leadFirstTouchSlaMinutes } from "../leads/lead-sla";
import { normalizePhoneDigits } from "../leads/phone-normalize";
import { resolveLeadStageKey } from "./lead-stage-resolve";
import type {
  LeadCommercialInput,
  LeadCoreInput,
  LeadFilesInput,
  LeadMeetingInput,
  LeadProposalInput,
  LeadEstimateInput,
  LeadMeasurementDecision,
} from "./lead-input.types";

function deriveMeasurementDecision(lead: LeadDetailRow): LeadMeasurementDecision {
  const ds = lead.qualification.decisionStatus?.toLowerCase() ?? "";
  if (ds.includes("skip") || ds.includes("без замір")) {
    return "skipped";
  }
  const meas = lead.calendarEvents.filter((e) => e.type === "MEASUREMENT");
  if (meas.some((e) => e.status === "COMPLETED")) {
    return "completed";
  }
  if (meas.some((e) => e.status !== "CANCELED")) {
    return "scheduled";
  }
  return "pending";
}

function buildCategories(lead: LeadDetailRow): Partial<Record<string, number>> {
  const acc: Partial<Record<string, number>> = {};
  for (const a of lead.attachments) {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
  }
  return acc;
}

function mapEstimates(lead: LeadDetailRow): LeadEstimateInput[] {
  return lead.estimates.map((e) => ({
    id: e.id,
    status: e.status,
    version: e.version,
    totalPrice: e.totalPrice,
  }));
}

function mapProposals(lead: LeadDetailRow): LeadProposalInput[] {
  return lead.proposals.map((p) => ({
    id: p.id,
    status: p.status,
    version: p.version,
    estimateId: p.estimateId ?? null,
    sentAt: p.sentAt ? p.sentAt.toISOString() : null,
    approvedAt: p.approvedAt ? p.approvedAt.toISOString() : null,
    hasSnapshot: p.hasSnapshot,
  }));
}

function buildMeetings(lead: LeadDetailRow): LeadMeetingInput {
  const meas = lead.calendarEvents.filter((e) => e.type === "MEASUREMENT");
  const now = Date.now();
  return {
    scheduledMeasurementCount: meas.filter((e) => e.status === "PLANNED" || e.status === "CONFIRMED").length,
    completedMeasurementCount: meas.filter((e) => e.status === "COMPLETED").length,
    hasUpcomingMeasurement: meas.some((e) => {
      if (e.status === "CANCELED" || e.status === "COMPLETED") return false;
      return new Date(e.startAt).getTime() >= now;
    }),
    hasAnyScheduledEvent: lead.calendarEvents.some(
      (e) => e.status !== "CANCELED",
    ),
  };
}

function hoursWithoutTouch(lead: LeadDetailRow): number | null {
  if (lead.lastActivityAt != null) return null;
  const h =
    (Date.now() - new Date(lead.createdAt).getTime()) / 3_600_000;
  return Number.isFinite(h) ? h : null;
}

/**
 * Мапер з повного рядка картки ліда (Prisma/query) у нормалізований вхід CRM Core.
 */
export function mapLeadDetailRowToCoreInput(lead: LeadDetailRow): LeadCoreInput {
  const phone = lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const email = lead.contact?.email?.trim() || lead.email?.trim() || null;
  const digits = normalizePhoneDigits(phone);
  const hasValidPhoneOrEmail =
    digits.length >= 9 || (email != null && email.length > 3);

  const stageKey = resolveLeadStageKey(lead.stage.slug, {
    isFinal: lead.stage.isFinal,
    finalType: lead.stage.finalType,
    stageName: lead.stage.name,
  });

  const estimates = mapEstimates(lead);
  const proposals = mapProposals(lead);
  const latestEstimate = estimates[0] ?? null;
  const latestProposal = proposals[0] ?? null;

  const commercial: LeadCommercialInput = {
    estimates,
    activeEstimateId: lead.activeEstimateId ?? null,
    proposals,
    activeProposalId: lead.activeProposalId ?? null,
    latestProposal,
    latestEstimate,
  };

  const cats = buildCategories(lead);
  const files: LeadFilesInput = {
    attachmentCount: lead.attachments.length,
    categories: cats,
    hasMeasurementSheet: (cats.MEASUREMENT_SHEET ?? 0) > 0,
    hasObjectPhotos:
      (cats.OBJECT_PHOTO ?? 0) > 0 || (cats.RESULT_PHOTO ?? 0) > 0,
  };

  const lastAt = lead.lastActivityAt;
  const daysSinceActivity =
    lastAt == null
      ? null
      : differenceInCalendarDays(new Date(), new Date(lastAt));

  const minsSinceCreate =
    (Date.now() - new Date(lead.createdAt).getTime()) / 60_000;
  const slaFirstTouchBreached =
    stageKey === "NEW" &&
    lead.lastActivityAt == null &&
    Number.isFinite(minsSinceCreate) &&
    minsSinceCreate > leadFirstTouchSlaMinutes();

  return {
    id: lead.id,
    stageKey,
    stageSlug: lead.stage.slug,
    isFinalStage: lead.stage.isFinal,
    finalType: lead.stage.finalType,
    source: lead.source,
    ownerId: lead.ownerId,
    ownerAssigned: Boolean(lead.ownerId),
    contact: {
      phone,
      email,
      contactId: lead.contactId,
      hasValidPhoneOrEmail,
    },
    qualification: {
      needsSummary: lead.qualification.needsSummary ?? null,
      furnitureType: lead.qualification.furnitureType ?? null,
      objectType: lead.qualification.objectType ?? null,
      budgetRange: lead.qualification.budgetRange ?? null,
      address: lead.qualification.address ?? null,
      measurementDecision: deriveMeasurementDecision(lead),
    },
    commercial,
    files,
    activity: {
      lastActivityAt: lead.lastActivityAt,
      createdAt: lead.createdAt,
      daysSinceActivity,
    },
    meetings: buildMeetings(lead),
    communication: {
      messageCount: lead.communication?.messageCount ?? 0,
      lastMessageAt: lead.communication?.lastMessageAt ?? null,
    },
    nextStepText: lead.nextStep,
    nextContactAt: lead.nextContactAt,
    projectAgreed: lead.projectAgreed === true,
    dealId: lead.dealId,
    hoursSinceCreatedWithoutTouch: hoursWithoutTouch(lead),
    slaFirstTouchBreached,
  };
}
