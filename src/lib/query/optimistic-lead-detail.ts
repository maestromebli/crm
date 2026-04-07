import type { LeadDetailRow } from "@/features/leads/queries";

type LeadPatchBody = Record<string, unknown>;

function parseNextContactAt(
  value: unknown,
  fallback: Date | null,
): Date | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") return fallback;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? fallback : next;
}

export function applyOptimisticLeadDetailPatch(
  previous: LeadDetailRow,
  body: LeadPatchBody,
): LeadDetailRow {
  let changed = false;
  let stage = previous.stage;
  let stageId = previous.stageId;
  let nextStep = previous.nextStep;
  let nextContactAt = previous.nextContactAt;

  if (typeof body.stageId === "string" && body.stageId !== previous.stageId) {
    const stageOpt = previous.pipelineStages.find((s) => s.id === body.stageId);
    if (stageOpt) {
      stageId = stageOpt.id;
      stage = {
        ...previous.stage,
        id: stageOpt.id,
        name: stageOpt.name,
        slug: stageOpt.slug,
        sortOrder: stageOpt.sortOrder,
        isFinal: stageOpt.isFinal,
        finalType: stageOpt.isFinal ? previous.stage.finalType : null,
      };
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "nextStep")) {
    if (typeof body.nextStep === "string") {
      nextStep = body.nextStep;
      changed = true;
    } else if (body.nextStep === null) {
      nextStep = null;
      changed = true;
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, "nextStepDate")) {
    const parsed = parseNextContactAt(body.nextStepDate, previous.nextContactAt);
    if (parsed !== previous.nextContactAt) {
      nextContactAt = parsed;
      changed = true;
    }
  }

  if (!changed) return previous;
  return {
    ...previous,
    stageId,
    stage,
    nextStep,
    nextContactAt,
  };
}
