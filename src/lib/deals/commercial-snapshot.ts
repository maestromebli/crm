import type { Prisma } from "@prisma/client";

import { parseProposalSnapshot } from "../leads/proposal-snapshot";

/** Незмінний знімок КП на замовленні (копія з LeadProposal). */
export type DealCommercialSnapshotV1 = {
  schema: "deal_commercial_snapshot_v1";
  frozenAt: string;
  sourceProposalId: string;
  sourceProposalVersion: number;
  proposalTitle: string | null;
  snapshotJson: Prisma.JsonValue | null;
  commercialTermsJson: Prisma.JsonValue | null;
};

export function parseDealCommercialSnapshot(
  raw: unknown,
): DealCommercialSnapshotV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== "deal_commercial_snapshot_v1") return null;
  if (typeof o.sourceProposalId !== "string") return null;
  if (typeof o.sourceProposalVersion !== "number") return null;
  if (typeof o.frozenAt !== "string") return null;
  return raw as DealCommercialSnapshotV1;
}

export function totalFromProposalSnapshotJson(
  snapshotJson: Prisma.JsonValue | null,
): number | null {
  if (snapshotJson == null) return null;
  const snap = parseProposalSnapshot(snapshotJson);
  if (!snap) return null;
  return typeof snap.total === "number" && Number.isFinite(snap.total)
    ? snap.total
    : null;
}

export function currencyFromProposalSnapshotJson(
  snapshotJson: Prisma.JsonValue | null,
): string | null {
  if (snapshotJson == null) return null;
  const snap = parseProposalSnapshot(snapshotJson);
  if (!snap) return null;
  const c = snap.currency?.trim();
  return c ? c : null;
}

export function buildDealCommercialSnapshotV1(args: {
  proposal: {
    id: string;
    version: number;
    title: string | null;
    snapshotJson: Prisma.JsonValue | null;
    commercialTermsJson: Prisma.JsonValue | null;
  };
  frozenAt: Date;
}): DealCommercialSnapshotV1 {
  return {
    schema: "deal_commercial_snapshot_v1",
    frozenAt: args.frozenAt.toISOString(),
    sourceProposalId: args.proposal.id,
    sourceProposalVersion: args.proposal.version,
    proposalTitle: args.proposal.title,
    snapshotJson: (args.proposal.snapshotJson ?? null) as Prisma.JsonValue | null,
    commercialTermsJson: args.proposal.commercialTermsJson ?? null,
  };
}
