import type { Prisma } from "@prisma/client";

import {
  estimateLinesToQuoteItems,
  newQuoteImage,
  type EstimateLineLike,
} from "../quotes/estimate-to-quote-items";
import type { QuoteItem } from "../quotes/quote-types";

/**
 * Знімок смети для LeadProposal.snapshotJson (контракт addon: proposal не змінюється при оновленні estimate).
 */
export type LeadProposalSnapshotV1 = {
  schema: "lead_proposal_snapshot_v1";
  capturedAt: string;
  estimateId: string;
  estimateVersion: number;
  currency: string;
  total: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  lineItems: Array<{
    id: string;
    type: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
  }>;
};

/** Знімок з деталізацією рядків (metadataJson) для КП/PDF як у Excel. */
export type LeadProposalSnapshotV2 = {
  schema: "lead_proposal_snapshot_v2";
  capturedAt: string;
  estimateId: string;
  estimateVersion: number;
  currency: string;
  total: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  lineItems: Array<{
    id: string;
    type: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    /** Деталізація матеріалів/фурнітури (EstimateLineItem.metadataJson). */
    metadataJson?: unknown;
  }>;
};

/** КП: груповані позиції (виріб/зона); матеріали — у descriptionLines. */
export type LeadProposalSnapshotV3 = {
  schema: "lead_proposal_snapshot_v3";
  capturedAt: string;
  estimateId: string;
  estimateVersion: number;
  currency: string;
  total: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  /** Позиції таблиці КП */
  quoteItems: QuoteItem[];
  /** Копія рядків смети для аудиту (як у v2) */
  sourceLineItems: LeadProposalSnapshotV2["lineItems"];
};

export function parseProposalSnapshot(
  raw: unknown,
): LeadProposalSnapshotV1 | LeadProposalSnapshotV2 | LeadProposalSnapshotV3 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.schema === "lead_proposal_snapshot_v1") {
    return raw as LeadProposalSnapshotV1;
  }
  if (o.schema === "lead_proposal_snapshot_v2") {
    return raw as LeadProposalSnapshotV2;
  }
  if (o.schema === "lead_proposal_snapshot_v3") {
    return raw as LeadProposalSnapshotV3;
  }
  return null;
}

export function buildProposalSnapshotFromEstimate(e: {
  id: string;
  version: number;
  totalPrice: number | null;
  discountAmount: number | null;
  deliveryCost: number | null;
  installationCost: number | null;
  notes: string | null;
  lineItems: Array<{
    id: string;
    type: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  }>;
}): Prisma.InputJsonValue {
  const snap: LeadProposalSnapshotV2 = {
    schema: "lead_proposal_snapshot_v2",
    capturedAt: new Date().toISOString(),
    estimateId: e.id,
    estimateVersion: e.version,
    currency: "UAH",
    total: e.totalPrice,
    discountAmount: e.discountAmount,
    deliveryCost: e.deliveryCost,
    installationCost: e.installationCost,
    notes: e.notes,
    lineItems: e.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      amountSale: li.amountSale,
      ...(li.metadataJson !== undefined && li.metadataJson !== null
        ? { metadataJson: li.metadataJson }
        : {}),
    })),
  };
  return snap as unknown as Prisma.InputJsonValue;
}

function mapLineItemsToSnapshotLines(
  lineItems: Array<{
    id: string;
    type: string;
    category: string | null;
    productName: string;
    qty: number;
    unit: string;
    salePrice: number;
    amountSale: number;
    metadataJson?: unknown;
  }>,
): LeadProposalSnapshotV2["lineItems"] {
  return lineItems.map((li) => ({
    id: li.id,
    type: li.type,
    category: li.category,
    productName: li.productName,
    qty: li.qty,
    unit: li.unit,
    salePrice: li.salePrice,
    amountSale: li.amountSale,
    ...(li.metadataJson !== undefined && li.metadataJson !== null
      ? { metadataJson: li.metadataJson }
      : {}),
  }));
}

export function buildProposalSnapshotV3FromEstimate(
  e: {
    id: string;
    version: number;
    name?: string | null;
    templateKey?: string | null;
    totalPrice: number | null;
    discountAmount: number | null;
    deliveryCost: number | null;
    installationCost: number | null;
    notes: string | null;
    lineItems: Array<{
      id: string;
      type: string;
      category: string | null;
      productName: string;
      qty: number;
      unit: string;
      salePrice: number;
      amountSale: number;
      metadataJson?: unknown;
    }>;
  },
  opts?: { quoteItems?: QuoteItem[] },
): Prisma.InputJsonValue {
  const sourceLineItems = mapLineItemsToSnapshotLines(e.lineItems);
  const linesLike: EstimateLineLike[] = e.lineItems.map((li) => ({
    id: li.id,
    type: li.type,
    category: li.category,
    productName: li.productName,
    qty: li.qty,
    unit: li.unit,
    salePrice: li.salePrice,
    amountSale: li.amountSale,
    metadataJson: li.metadataJson,
  }));
  const quoteItems =
    opts?.quoteItems && opts.quoteItems.length > 0
      ? opts.quoteItems.map((it, i) => ({ ...it, sortOrder: i }))
      : estimateLinesToQuoteItems(linesLike, {
          estimateName: e.name,
          estimateTemplateKey: e.templateKey ?? null,
        });

  const snap: LeadProposalSnapshotV3 = {
    schema: "lead_proposal_snapshot_v3",
    capturedAt: new Date().toISOString(),
    estimateId: e.id,
    estimateVersion: e.version,
    currency: "UAH",
    total: e.totalPrice,
    discountAmount: e.discountAmount,
    deliveryCost: e.deliveryCost,
    installationCost: e.installationCost,
    notes: e.notes,
    quoteItems,
    sourceLineItems,
  };
  return snap as unknown as Prisma.InputJsonValue;
}

/**
 * Підставляє URL зображень у quoteItems[i] знімка v3 (колонка «Віз»), індекс 1:1 з рядками КП.
 */
export function applyVisualizationUrlsToQuoteSnapshot(
  snapshotJson: Prisma.InputJsonValue,
  urls: string[],
): Prisma.InputJsonValue {
  const snap = parseProposalSnapshot(snapshotJson);
  if (snap?.schema !== "lead_proposal_snapshot_v3" || !snap.quoteItems?.length) {
    return snapshotJson;
  }
  const quoteItems = snap.quoteItems.map((it, i) => {
    const raw = urls[i];
    const u = typeof raw === "string" ? raw.trim() : "";
    if (!u) return it;
    return {
      ...it,
      images: [newQuoteImage(u, 0)],
    };
  });
  const out: LeadProposalSnapshotV3 = {
    ...snap,
    quoteItems,
  };
  return out as unknown as Prisma.InputJsonValue;
}

/** Оновлення snapshot v3 при редагуванні позицій КП (PATCH). */
export function rebuildProposalSnapshotV3(args: {
  previousSnapshot: unknown;
  estimate: {
    id: string;
    version: number;
    totalPrice: number | null;
    discountAmount: number | null;
    deliveryCost: number | null;
    installationCost: number | null;
    notes: string | null;
    lineItems: Array<{
      id: string;
      type: string;
      category: string | null;
      productName: string;
      qty: number;
      unit: string;
      salePrice: number;
      amountSale: number;
      metadataJson?: unknown;
    }>;
  };
  quoteItems: QuoteItem[];
}): Prisma.InputJsonValue {
  const snap = parseProposalSnapshot(args.previousSnapshot);
  const sourceLineItems = mapLineItemsToSnapshotLines(args.estimate.lineItems);
  const prev = snap?.schema === "lead_proposal_snapshot_v3" ? snap : null;

  const out: LeadProposalSnapshotV3 = {
    schema: "lead_proposal_snapshot_v3",
    capturedAt: new Date().toISOString(),
    estimateId: args.estimate.id,
    estimateVersion: args.estimate.version,
    currency: prev?.currency ?? snap?.currency ?? "UAH",
    total: prev?.total ?? snap?.total ?? args.estimate.totalPrice,
    discountAmount:
      prev?.discountAmount ??
      snap?.discountAmount ??
      args.estimate.discountAmount,
    deliveryCost:
      prev?.deliveryCost ?? snap?.deliveryCost ?? args.estimate.deliveryCost,
    installationCost:
      prev?.installationCost ??
      snap?.installationCost ??
      args.estimate.installationCost,
    notes: prev?.notes ?? snap?.notes ?? args.estimate.notes,
    quoteItems: args.quoteItems.map((it, i) => ({ ...it, sortOrder: i })),
    sourceLineItems,
  };
  return out as unknown as Prisma.InputJsonValue;
}
