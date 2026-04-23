import { prisma } from "../prisma";
import type { SessionUser } from "../authz/api-guard";
import { logAiEvent } from "./log-ai-event";

const SETTINGS_ID = "default";
const ENTITY_TYPE = "AI_TEMPLATE_CHANGE";
const ACTION_CREATE = "settings_ai_template_change_proposal_created";
const ACTION_DECISION = "settings_ai_template_change_proposal_decision";
const ACTION_APPLY = "settings_ai_template_change_proposal_applied";

export type TemplateProposalStatus =
  | "DRAFT"
  | "APPROVED"
  | "REJECTED"
  | "APPLIED";

export type TemplateChangeProposal = {
  proposalId: string;
  title: string;
  templateKey: string;
  beforeTemplate: string;
  afterTemplate: string;
  expectedImpact: string;
  rollbackPlan: string;
  createdAt: string;
  createdByUserId: string | null;
  createdByRole: string | null;
  status: TemplateProposalStatus;
  statusAt: string;
  statusByUserId: string | null;
  statusByRole: string | null;
  decisionComment: string | null;
};

type CreateTemplateChangeProposalInput = {
  title: string;
  templateKey: string;
  beforeTemplate: string;
  afterTemplate: string;
  expectedImpact: string;
  rollbackPlan: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isExecutiveApprover(user: SessionUser): boolean {
  const role = String(user.realRole || user.dbRole || "").toUpperCase();
  return role === "SUPER_ADMIN" || role === "DIRECTOR" || role === "ADMIN";
}

function ensureDatabaseEnabled(): void {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createTemplateChangeProposal(
  user: SessionUser,
  input: CreateTemplateChangeProposalInput,
): Promise<{ proposalId: string }> {
  ensureDatabaseEnabled();
  const proposalId = `tplchg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await logAiEvent({
    userId: user.id,
    action: ACTION_CREATE,
    entityType: ENTITY_TYPE,
    entityId: proposalId,
    ok: true,
    metadata: {
      proposalId,
      title: input.title,
      templateKey: input.templateKey,
      beforeTemplate: input.beforeTemplate,
      afterTemplate: input.afterTemplate,
      expectedImpact: input.expectedImpact,
      rollbackPlan: input.rollbackPlan,
      createdByRole: user.realRole ?? user.dbRole ?? null,
      createdAt: nowIso(),
      status: "DRAFT",
    },
  });
  return { proposalId };
}

export async function listTemplateChangeProposals(
  take = 30,
): Promise<TemplateChangeProposal[]> {
  ensureDatabaseEnabled();
  const rows = await prisma.aiAssistantLog.findMany({
    where: { entityType: ENTITY_TYPE },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(200, Math.floor(take))),
    select: {
      action: true,
      entityId: true,
      userId: true,
      createdAt: true,
      metadata: true,
    },
  });

  const map = new Map<string, TemplateChangeProposal>();
  for (const row of rows) {
    const proposalId = row.entityId?.trim() ?? "";
    if (!proposalId) continue;
    const meta = asRecord(row.metadata);
    if (!meta) continue;
    const statusInMeta = asTrimmedString(meta.status).toUpperCase();
    const actorRole =
      asTrimmedString(meta.actorRole) ||
      asTrimmedString(meta.createdByRole) ||
      null;

    if (row.action === ACTION_CREATE) {
      const title = asTrimmedString(meta.title);
      const templateKey = asTrimmedString(meta.templateKey);
      const beforeTemplate = asTrimmedString(meta.beforeTemplate);
      const afterTemplate = asTrimmedString(meta.afterTemplate);
      const expectedImpact = asTrimmedString(meta.expectedImpact);
      const rollbackPlan = asTrimmedString(meta.rollbackPlan);
      if (!title || !templateKey || !afterTemplate) continue;

      map.set(proposalId, {
        proposalId,
        title,
        templateKey,
        beforeTemplate,
        afterTemplate,
        expectedImpact,
        rollbackPlan,
        createdAt: row.createdAt.toISOString(),
        createdByUserId: row.userId ?? null,
        createdByRole: asTrimmedString(meta.createdByRole) || null,
        status: "DRAFT",
        statusAt: row.createdAt.toISOString(),
        statusByUserId: row.userId ?? null,
        statusByRole: asTrimmedString(meta.createdByRole) || null,
        decisionComment: null,
      });
      continue;
    }

    const existing = map.get(proposalId);
    if (!existing) continue;

    if (row.action === ACTION_DECISION && statusInMeta) {
      const nextStatus: TemplateProposalStatus =
        statusInMeta === "APPROVED" ? "APPROVED" : "REJECTED";
      existing.status = nextStatus;
      existing.statusAt = row.createdAt.toISOString();
      existing.statusByUserId = row.userId ?? null;
      existing.statusByRole = actorRole;
      existing.decisionComment = asTrimmedString(meta.comment) || null;
    }

    if (row.action === ACTION_APPLY) {
      existing.status = "APPLIED";
      existing.statusAt = row.createdAt.toISOString();
      existing.statusByUserId = row.userId ?? null;
      existing.statusByRole = actorRole;
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

async function getProposalOrThrow(
  proposalId: string,
): Promise<TemplateChangeProposal> {
  const proposals = await listTemplateChangeProposals(200);
  const found = proposals.find((p) => p.proposalId === proposalId);
  if (!found) throw new Error("PROPOSAL_NOT_FOUND");
  return found;
}

export async function decideTemplateChangeProposal(
  user: SessionUser,
  input: {
    proposalId: string;
    decision: "APPROVED" | "REJECTED";
    comment?: string;
  },
): Promise<{ status: TemplateProposalStatus }> {
  ensureDatabaseEnabled();
  if (!isExecutiveApprover(user)) {
    throw new Error("APPROVER_ROLE_REQUIRED");
  }
  const proposal = await getProposalOrThrow(input.proposalId);
  if (proposal.status === "APPLIED") {
    throw new Error("PROPOSAL_ALREADY_APPLIED");
  }

  await logAiEvent({
    userId: user.id,
    action: ACTION_DECISION,
    entityType: ENTITY_TYPE,
    entityId: input.proposalId,
    ok: true,
    metadata: {
      proposalId: input.proposalId,
      status: input.decision,
      comment: input.comment?.trim() || null,
      actorRole: user.realRole ?? user.dbRole ?? null,
      actedAt: nowIso(),
    },
  });

  return { status: input.decision };
}

async function writeTemplateToSystemSettings(
  userId: string,
  proposal: TemplateChangeProposal,
): Promise<void> {
  const row = await prisma.systemSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { communicationsJson: true },
  });
  const root =
    row?.communicationsJson &&
    typeof row.communicationsJson === "object" &&
    !Array.isArray(row.communicationsJson)
      ? ({ ...row.communicationsJson } as Record<string, unknown>)
      : {};
  const aiSoulRaw = asRecord(root.aiSoul) ?? {};
  const templatesRaw = asRecord(aiSoulRaw.templates) ?? {};
  templatesRaw[proposal.templateKey] = {
    title: proposal.title,
    body: proposal.afterTemplate,
    expectedImpact: proposal.expectedImpact,
    rollbackPlan: proposal.rollbackPlan,
    proposalId: proposal.proposalId,
    appliedAt: nowIso(),
    appliedBy: userId,
  };
  aiSoulRaw.templates = templatesRaw;
  root.aiSoul = aiSoulRaw;

  await prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      communicationsJson: root as object,
      updatedById: userId,
    },
    update: {
      communicationsJson: root as object,
      updatedById: userId,
    },
  });
}

export async function applyTemplateChangeProposal(
  user: SessionUser,
  proposalId: string,
): Promise<{ status: TemplateProposalStatus }> {
  ensureDatabaseEnabled();
  if (!isExecutiveApprover(user)) {
    throw new Error("APPROVER_ROLE_REQUIRED");
  }
  const proposal = await getProposalOrThrow(proposalId);
  if (proposal.status !== "APPROVED") {
    throw new Error("PROPOSAL_MUST_BE_APPROVED");
  }

  await writeTemplateToSystemSettings(user.id, proposal);
  await logAiEvent({
    userId: user.id,
    action: ACTION_APPLY,
    entityType: ENTITY_TYPE,
    entityId: proposal.proposalId,
    ok: true,
    metadata: {
      proposalId: proposal.proposalId,
      status: "APPLIED",
      actorRole: user.realRole ?? user.dbRole ?? null,
      templateKey: proposal.templateKey,
      actedAt: nowIso(),
    },
  });
  return { status: "APPLIED" };
}
