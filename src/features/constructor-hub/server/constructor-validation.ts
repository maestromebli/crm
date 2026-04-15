import { z } from "zod";
import type { ConstructorWorkspaceStatus } from "@prisma/client";

const transitionMap: Record<ConstructorWorkspaceStatus, ConstructorWorkspaceStatus[]> = {
  NOT_ASSIGNED: ["ASSIGNED"],
  ASSIGNED: ["REVIEWING_INPUT"],
  REVIEWING_INPUT: ["QUESTIONS_OPEN", "IN_PROGRESS"],
  QUESTIONS_OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["DRAFT_UPLOADED"],
  DRAFT_UPLOADED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["REVISION_REQUESTED", "APPROVED"],
  REVISION_REQUESTED: ["IN_PROGRESS"],
  APPROVED: ["HANDED_OFF_TO_PRODUCTION"],
  HANDED_OFF_TO_PRODUCTION: [],
  CANCELLED: [],
};

export function ensureWorkspaceTransition(
  from: ConstructorWorkspaceStatus,
  to: ConstructorWorkspaceStatus,
): void {
  if (from === to) return;
  const allowed = transitionMap[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Недопустимый переход статуса: ${from} -> ${to}`);
  }
}

export const constructorCreateWorkspaceSchema = z.object({
  dealId: z.string().min(1),
  productionFlowId: z.string().min(1).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().optional(),
});

export const constructorAssignSchema = z.object({
  assignedConstructorUserId: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
});

export const constructorTechSpecSchema = z.object({
  generalInfoJson: z.unknown().optional(),
  zonesJson: z.unknown().optional(),
  modulesJson: z.unknown().optional(),
  materialsJson: z.unknown().optional(),
  facadesJson: z.unknown().optional(),
  fittingsJson: z.unknown().optional(),
  lightingAndAppliancesJson: z.unknown().optional(),
  installationNotesJson: z.unknown().optional(),
  risksJson: z.unknown().optional(),
  requiredAttentionJson: z.unknown().optional(),
  sourceSnapshotJson: z.unknown().optional(),
  approvedDataSnapshotJson: z.unknown().optional(),
});

export const constructorQuestionSchema = z.object({
  assignedToUserId: z.string().min(1).optional().nullable(),
  assignedRole: z.string().max(64).optional().nullable(),
  category: z.enum(["DIMENSIONS", "MATERIALS", "FITTINGS", "APPLIANCES", "INSTALLATION", "DESIGN", "PRODUCTION", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(2).max(280),
  description: z.string().min(2).max(5000),
  isCritical: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

export const constructorQuestionAnswerSchema = z.object({
  answerText: z.string().min(1).max(5000),
  closeAfterAnswer: z.boolean().optional(),
});

export const constructorFileSchema = z.object({
  versionId: z.string().optional().nullable(),
  fileStorageKey: z.string().max(500).optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  originalName: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(160),
  extension: z.string().min(1).max(32),
  sizeBytes: z.number().int().nonnegative().optional(),
  fileCategory: z.enum([
    "CLIENT_PROJECT",
    "OBJECT_PHOTO",
    "MEASUREMENT",
    "VIDEO",
    "REFERENCE",
    "APPROVED_QUOTE",
    "APPROVED_MATERIALS",
    "REVISION_COMMENT",
    "CONSTRUCTOR_DRAFT",
    "CONSTRUCTOR_FINAL",
    "SPECIFICATION",
    "FITTINGS_LIST",
    "MATERIALS_LIST",
    "CNC_FILE",
    "DRAWING",
    "ASSEMBLY_SCHEME",
    "PRODUCTION_PACKAGE",
    "ARCHIVE",
    "OTHER",
  ]),
  versionLabel: z.string().max(120).optional().nullable(),
  isImportant: z.boolean().optional(),
  comment: z.string().max(2000).optional().nullable(),
});

export const constructorVersionSchema = z.object({
  type: z.enum(["DRAFT", "REVIEW", "FINAL"]),
  summary: z.string().min(4).max(4000),
});

export const constructorReviewSchema = z.object({
  decision: z.enum(["APPROVE", "RETURN_FOR_REVISION", "COMMENT_ONLY"]),
  comment: z.string().max(5000).optional().nullable(),
  severity: z.enum(["INFO", "MINOR", "MAJOR", "CRITICAL"]).optional(),
  checklistJson: z.unknown().optional(),
  remarksJson: z.unknown().optional(),
});

export const constructorZoneProgressSchema = z.object({
  zoneKey: z.string().min(1).max(120),
  zoneTitle: z.string().min(1).max(160),
  progressPercent: z.number().int().min(0).max(100),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "READY", "APPROVED"]),
  notes: z.string().max(2000).optional().nullable(),
});
