/**
 * Модель друку КП з LeadProposal + Estimate: груповані позиції (quoteItems),
 * без окремих рядків на кожен матеріал.
 */
import { estimateLinesToQuoteItems } from "../quotes/estimate-to-quote-items";
import type { QuoteItem } from "../quotes/quote-types";
import type { QuotePrintModel, QuotePrintRow } from "../quotes/quote-types";
import {
  parseProposalSnapshot,
  type LeadProposalSnapshotV1,
  type LeadProposalSnapshotV2,
  type LeadProposalSnapshotV3,
} from "./proposal-snapshot";

export type { QuotePrintModel, QuotePrintRow } from "../quotes/quote-types";

type LineSource = {
  id: string;
  type: string;
  category: string | null;
  productName: string;
  qty: number;
  unit: string;
  salePrice: number;
  amountSale: number;
  metadataJson?: unknown;
};

function getLinesFromSnapshot(
  snap: LeadProposalSnapshotV1 | LeadProposalSnapshotV2 | LeadProposalSnapshotV3 | null,
  fallback: LineSource[] | null,
): LineSource[] {
  if (snap?.schema === "lead_proposal_snapshot_v3") {
    return snap.sourceLineItems.map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      amountSale: li.amountSale,
      metadataJson:
        "metadataJson" in li
          ? (li as { metadataJson?: unknown }).metadataJson
          : undefined,
    }));
  }
  if (snap?.lineItems?.length) {
    return snap.lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      amountSale: li.amountSale,
      metadataJson:
        "metadataJson" in li
          ? (li as { metadataJson?: unknown }).metadataJson
          : undefined,
    }));
  }
  return fallback ?? [];
}

function resolveQuoteItems(
  snap: LeadProposalSnapshotV1 | LeadProposalSnapshotV2 | LeadProposalSnapshotV3 | null,
  lines: LineSource[],
  estimateName: string | null | undefined,
  estimateTemplateKey?: string | null,
): QuoteItem[] {
  if (snap?.schema === "lead_proposal_snapshot_v3" && snap.quoteItems?.length) {
    return [...snap.quoteItems].sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return estimateLinesToQuoteItems(lines, {
    estimateName,
    estimateTemplateKey: estimateTemplateKey ?? null,
  });
}

/** Рядкова сума для колонки «Ціна»: totalPrice або quantity × unitPrice */
function lineDisplayAmount(it: QuoteItem): number {
  if (
    it.unitPrice != null &&
    Number.isFinite(it.unitPrice) &&
    it.quantity > 0
  ) {
    return Math.round(it.unitPrice * it.quantity * 100) / 100;
  }
  return Math.round(it.totalPrice * 100) / 100;
}

export function buildQuotePrintModelFromEntities(args: {
  leadTitle: string;
  /** Глобальне фото з КП/ліда — підставляється у перший рядок без зображень */
  fallbackImageUrl?: string | null;
  proposal: {
    title: string | null;
    version: number;
    createdAt: Date;
    summary: string | null;
    notes: string | null;
    snapshotJson: unknown;
    visualizationUrl?: string | null;
  };
  estimate: {
    name?: string | null;
    templateKey?: string | null;
    version: number;
    totalPrice: number | null;
    discountAmount: number | null;
    deliveryCost: number | null;
    installationCost: number | null;
    lineItems: LineSource[];
  } | null;
}): QuotePrintModel {
  const snap = parseProposalSnapshot(args.proposal.snapshotJson);
  const est = args.estimate;
  const lines = getLinesFromSnapshot(
    snap,
    est?.lineItems.map((li) => ({ ...li })) ?? null,
  );
  const items = resolveQuoteItems(
    snap,
    lines,
    est?.name,
    est?.templateKey ?? null,
  );

  const d =
    typeof args.proposal.createdAt === "string"
      ? new Date(args.proposal.createdAt)
      : args.proposal.createdAt;
  const issuedAtLabel = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
  const issuedAtShort = Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

  const globalVis =
    (typeof args.proposal.visualizationUrl === "string" &&
    args.proposal.visualizationUrl.trim()
      ? args.proposal.visualizationUrl.trim()
      : null) ??
    (typeof args.fallbackImageUrl === "string" && args.fallbackImageUrl.trim()
      ? args.fallbackImageUrl.trim()
      : null);

  const rows: QuotePrintRow[] = items.map((it, idx) => {
    const urls = [...it.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => im.url)
      .filter(Boolean);
    if (!urls.length && idx === 0 && globalVis) {
      urls.push(globalVis);
    }
    return {
      no: idx + 1,
      title: it.title,
      quantity: it.quantity,
      lineTotal: lineDisplayAmount(it),
      descriptionLines: [...it.descriptionLines],
      imageUrls: urls,
    };
  });

  const currency =
    snap?.currency ??
    (est ? "UAH" : "UAH");
  const currencyLabel =
    currency === "UAH" || currency === "грн" ? "грн" : currency;

  return {
    docTitle: `Комерційна пропозиція-${args.proposal.version} на виготовлення меблів ${issuedAtShort}`,
    objectLine: args.proposal.title?.trim() || args.leadTitle || "—",
    proposalVersion: args.proposal.version,
    estimateVersion: snap?.estimateVersion ?? est?.version ?? null,
    issuedAtLabel,
    issuedAtShort,
    currencyLabel,
    rows,
    totals: {
      discountAmount: snap?.discountAmount ?? est?.discountAmount ?? null,
      deliveryCost: snap?.deliveryCost ?? est?.deliveryCost ?? null,
      installationCost:
        snap?.installationCost ?? est?.installationCost ?? null,
      total: snap?.total ?? est?.totalPrice ?? null,
    },
    summary:
      args.proposal.summary?.trim() ||
      args.proposal.notes?.trim() ||
      snap?.notes ||
      null,
  };
}

/** @deprecated Використовуйте buildQuotePrintModelFromEntities */
export function buildProposalDocumentModelFromEntities(
  args: Parameters<typeof buildQuotePrintModelFromEntities>[0],
): QuotePrintModel {
  return buildQuotePrintModelFromEntities(args);
}
