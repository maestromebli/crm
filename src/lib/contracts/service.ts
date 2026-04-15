import { createHash, randomBytes } from "node:crypto";
import type { DealContractStatus, Prisma, PrismaClient } from "@prisma/client";
import { parseProposalSnapshot } from "@/lib/leads/proposal-snapshot";
import { buildSeededContractDraft, toDealForContractSeed } from "@/lib/deals/contract-draft-seed";
import { renderDealContractPdf } from "@/lib/deals/render-deal-contract-pdf";
import { saveDealBufferPrivate } from "@/lib/uploads/lead-disk-upload";
import { dealContractToApiStatus, type ContractApiStatus, apiToDealContractStatus } from "./status-map";
import { amountToWordsUk, formatCurrencyUAH, formatUADate, renderSpecificationRows } from "./formatters";

type SpecificationItem = {
  lineNumber: number;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string | null;
};

type ContractContentJson = {
  fields?: Record<string, unknown>;
  specification?: {
    items: SpecificationItem[];
    subtotal: number;
    total: number;
    formattedTotalText: string;
    currency: string;
  };
  share?: {
    latestToken?: string;
    expiresAt?: string;
  };
};

function toObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return input as Record<string, unknown>;
}

function buildSpecificationFromProposalSnapshot(snapshotJson: unknown): {
  items: SpecificationItem[];
  subtotal: number;
  total: number;
  currency: string;
} {
  const parsed = parseProposalSnapshot(snapshotJson);
  if (!parsed) {
    return { items: [], subtotal: 0, total: 0, currency: "UAH" };
  }

  const rows =
    parsed.schema === "lead_proposal_snapshot_v3"
      ? parsed.quoteItems.map((item, idx) => {
          const qty = Number.isFinite(item.quantity) ? item.quantity : 1;
          const total = Number.isFinite(item.totalPrice) ? item.totalPrice : 0;
          const unitPrice =
            item.unitPrice != null && Number.isFinite(item.unitPrice)
              ? item.unitPrice
              : qty > 0
                ? total / qty
                : total;
          return {
            lineNumber: idx + 1,
            productName: item.title,
            unit: "компл.",
            quantity: qty,
            unitPrice: Math.round(unitPrice * 100) / 100,
            lineTotal: Math.round(total * 100) / 100,
            notes: item.descriptionLines?.join("; ") ?? "",
          };
        })
      : parsed.lineItems.map((item, idx) => ({
          lineNumber: idx + 1,
          productName: item.productName,
          unit: item.unit,
          quantity: item.qty,
          unitPrice: item.salePrice,
          lineTotal: item.amountSale,
          notes: null,
        }));

  const subtotal = Math.round(rows.reduce((acc, row) => acc + row.lineTotal, 0) * 100) / 100;
  const total = parsed.total != null ? parsed.total : subtotal;
  return {
    items: rows,
    subtotal,
    total,
    currency: parsed.currency ?? "UAH",
  };
}

export async function createContractFromQuotation(args: {
  prisma: PrismaClient;
  dealId: string;
  quotationId: string;
  userId: string;
  fields?: Record<string, unknown>;
}) {
  const deal = await args.prisma.deal.findUnique({
    where: { id: args.dealId },
    select: {
      id: true,
      title: true,
      value: true,
      currency: true,
      expectedCloseDate: true,
      description: true,
      ownerId: true,
      client: { select: { name: true, type: true } },
      primaryContact: { select: { fullName: true, city: true, country: true, phone: true, email: true } },
      owner: { select: { name: true, email: true } },
      contract: { select: { id: true } },
    },
  });
  if (!deal) throw new Error("DEAL_NOT_FOUND");
  if (deal.contract) throw new Error("CONTRACT_ALREADY_EXISTS");

  const quotation = await args.prisma.leadProposal.findUnique({
    where: { id: args.quotationId },
    select: {
      id: true,
      leadId: true,
      snapshotJson: true,
      title: true,
      version: true,
      lead: { select: { dealId: true } },
    },
  });
  if (!quotation) throw new Error("QUOTATION_NOT_FOUND");
  if (quotation.lead?.dealId && quotation.lead.dealId !== args.dealId) {
    throw new Error("QUOTATION_DEAL_MISMATCH");
  }

  const spec = buildSpecificationFromProposalSnapshot(quotation.snapshotJson);
  const seededDraft = buildSeededContractDraft({
    deal: toDealForContractSeed({ ...deal, paymentMilestones: [] }),
    recipientType: deal.client.type === "COMPANY" ? "CLIENT_COMPANY" : "CLIENT_PERSON",
  });

  const fieldsFromRequest = toObject(args.fields);
  const contentJson: ContractContentJson = {
    fields: {
      contractNumber: fieldsFromRequest.contractNumber ?? seededDraft.variables.contractNumber ?? `EN-${Date.now()}`,
      contractDate: fieldsFromRequest.contractDate ?? new Date().toISOString(),
      customerType: fieldsFromRequest.customerType ?? (deal.client.type === "COMPANY" ? "COMPANY" : "PERSON"),
      customerFullName: fieldsFromRequest.customerFullName ?? deal.primaryContact?.fullName ?? deal.client.name,
      customerTaxId: fieldsFromRequest.customerTaxId ?? seededDraft.variables.customerTaxId ?? "",
      customerPassportData: fieldsFromRequest.customerPassportData ?? "",
      customerPhone: fieldsFromRequest.customerPhone ?? deal.primaryContact?.phone ?? "",
      customerEmail: fieldsFromRequest.customerEmail ?? deal.primaryContact?.email ?? "",
      objectAddress: fieldsFromRequest.objectAddress ?? seededDraft.variables.objectAddress ?? "",
      deliveryAddress: fieldsFromRequest.deliveryAddress ?? seededDraft.variables.objectAddress ?? "",
      totalAmount: fieldsFromRequest.totalAmount ?? spec.total,
      advanceAmount: fieldsFromRequest.advanceAmount ?? Math.round(spec.total * 0.7 * 100) / 100,
      remainingAmount:
        fieldsFromRequest.remainingAmount ??
        (Math.round(spec.total * 100) / 100 - Math.round(spec.total * 0.7 * 100) / 100),
      productionLeadTimeDays: fieldsFromRequest.productionLeadTimeDays ?? 30,
      installationLeadTime: fieldsFromRequest.installationLeadTime ?? "3-5 робочих днів",
      paymentTerms: fieldsFromRequest.paymentTerms ?? "70% аванс / 30% перед монтажем",
      warrantyMonths: fieldsFromRequest.warrantyMonths ?? 18,
      managerComment: fieldsFromRequest.managerComment ?? "",
      specialConditions: fieldsFromRequest.specialConditions ?? "",
      supplierSignerName: fieldsFromRequest.supplierSignerName ?? "Мамедов Енвер Мікаілович",
      supplierSignerBasis: fieldsFromRequest.supplierSignerBasis ?? "ФОП",
      quotationId: quotation.id,
      quotationVersion: quotation.version,
    },
    specification: {
      items: spec.items,
      subtotal: spec.subtotal,
      total: spec.total,
      currency: spec.currency,
      formattedTotalText: amountToWordsUk(spec.total),
    },
  };

  const content = {
    ...seededDraft,
    contentJson,
  } as Prisma.InputJsonValue;

  const created = await args.prisma.dealContract.create({
    data: {
      dealId: args.dealId,
      status: "EDITED",
      templateKey: seededDraft.templateKey,
      content: content as unknown as object,
    },
  });

  await args.prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: args.dealId,
      type: "CONTRACT_CREATED",
      actorUserId: args.userId,
      source: "USER",
      data: {
        action: "create_from_quotation",
        quotationId: args.quotationId,
        contractId: created.id,
      },
    },
  });

  return created;
}

export function mapContractDetails(contract: {
  id: string;
  dealId: string;
  status: any;
  templateKey: string | null;
  version: number;
  content: unknown;
  signedPdfUrl: string | null;
  diiaSessionId: string | null;
  updatedAt: Date;
  createdAt: Date;
}) {
  const content = toObject(contract.content);
  const contentJson = toObject(content.contentJson);
  const fields = toObject(contentJson.fields);
  const specificationRaw = toObject(contentJson.specification);
  const itemsRaw = Array.isArray(specificationRaw.items) ? specificationRaw.items : [];
  const items = itemsRaw.map((item, index) => {
    const row = toObject(item);
    return {
      lineNumber: Number(row.lineNumber ?? index + 1),
      productName: String(row.productName ?? ""),
      unit: String(row.unit ?? "шт"),
      quantity: Number(row.quantity ?? 0),
      unitPrice: Number(row.unitPrice ?? 0),
      lineTotal: Number(row.lineTotal ?? 0),
      notes: typeof row.notes === "string" ? row.notes : null,
    };
  });

  return {
    id: contract.id,
    dealId: contract.dealId,
    status: dealContractToApiStatus(contract.status),
    rawStatus: contract.status,
    templateKey: contract.templateKey,
    version: contract.version,
    fields,
    preview: {
      contractNumber: String(fields.contractNumber ?? ""),
      contractDate: formatUADate(fields.contractDate ? String(fields.contractDate) : contract.createdAt),
      customerFullName: String(fields.customerFullName ?? ""),
      totalAmount: Number(fields.totalAmount ?? 0),
      totalAmountFormatted: formatCurrencyUAH(Number(fields.totalAmount ?? 0)),
      advanceAmount: Number(fields.advanceAmount ?? 0),
      remainingAmount: Number(fields.remainingAmount ?? 0),
    },
    specification: {
      items,
      subtotal: Number(specificationRaw.subtotal ?? 0),
      total: Number(specificationRaw.total ?? 0),
      formattedTotalText: String(specificationRaw.formattedTotalText ?? ""),
      currency: String(specificationRaw.currency ?? "UAH"),
    },
    signedPdfUrl: contract.signedPdfUrl,
    diiaSessionId: contract.diiaSessionId,
    updatedAt: contract.updatedAt.toISOString(),
    createdAt: contract.createdAt.toISOString(),
  };
}

export function ensureContractUpdateAllowed(args: {
  currentStatus: DealContractStatus;
  targetStatus?: ContractApiStatus;
  updates?: Record<string, unknown>;
}) {
  if (args.currentStatus === "CLIENT_SIGNED" || args.currentStatus === "FULLY_SIGNED" || args.currentStatus === "COMPANY_SIGNED") {
    throw new Error("CONTRACT_EDIT_LOCKED_AFTER_SIGN");
  }

  const updates = args.updates ?? {};
  const changesFinancial = ["totalAmount", "advanceAmount", "remainingAmount"].some((k) => k in updates);
  const changesSpecification = "specificationItems" in updates;
  if (
    args.currentStatus === "APPROVED_INTERNAL" &&
    (changesFinancial || changesSpecification) &&
    args.targetStatus !== "NEEDS_REVISION"
  ) {
    throw new Error("NEEDS_REVISION_REQUIRED");
  }
}

export async function generateContractDocuments(args: {
  prisma: PrismaClient;
  contractId: string;
  userId: string;
}) {
  const contract = await args.prisma.dealContract.findUnique({
    where: { id: args.contractId },
    include: { deal: { select: { id: true } } },
  });
  if (!contract) throw new Error("CONTRACT_NOT_FOUND");
  const mapped = mapContractDetails(contract);
  const html = String(toObject(toObject(contract.content).contentJson).contractHtml ?? toObject(contract.content).contentHtml ?? "");

  const pdf = await renderDealContractPdf({
    title: `Договір №${mapped.preview.contractNumber || contract.id}`,
    contentHtml: html,
    variables: Object.fromEntries(
      Object.entries(mapped.fields).map(([k, v]) => [k, String(v ?? "")]),
    ),
  });

  const specificationHtml = `<!doctype html><html><body>
<h2>Додаток №1 — Специфікація</h2>
<table border="1" cellspacing="0" cellpadding="4">
<thead><tr><th>#</th><th>Найменування</th><th>Од.</th><th>К-сть</th><th>Ціна</th><th>Сума</th><th>Примітки</th></tr></thead>
<tbody>${renderSpecificationRows(mapped.specification.items)}</tbody>
</table>
<p>Разом: ${formatCurrencyUAH(mapped.specification.total)} (${mapped.specification.formattedTotalText})</p>
</body></html>`;

  const specPdf = await renderDealContractPdf({
    title: `Специфікація до договору №${mapped.preview.contractNumber || contract.id}`,
    contentHtml: specificationHtml,
    variables: {},
  });

  const contractAttachmentId = randomBytes(12).toString("hex");
  const contractSaved = await saveDealBufferPrivate({
    dealId: contract.dealId,
    attachmentId: contractAttachmentId,
    buffer: Buffer.from(pdf),
    fileName: `contract-${contract.dealId}.pdf`,
    mimeType: "application/pdf",
  });
  await args.prisma.attachment.create({
    data: {
      id: contractAttachmentId,
      fileName: contractSaved.originalName,
      fileUrl: contractSaved.fileUrl,
      storageKey: contractSaved.storageKey,
      mimeType: contractSaved.mimeType,
      fileSize: contractSaved.bytes,
      category: "CONTRACT",
      entityType: "DEAL",
      entityId: contract.dealId,
      uploadedById: args.userId,
    },
  });

  const specAttachmentId = randomBytes(12).toString("hex");
  const specSaved = await saveDealBufferPrivate({
    dealId: contract.dealId,
    attachmentId: specAttachmentId,
    buffer: Buffer.from(specPdf),
    fileName: `specification-${contract.dealId}.pdf`,
    mimeType: "application/pdf",
  });
  await args.prisma.attachment.create({
    data: {
      id: specAttachmentId,
      fileName: specSaved.originalName,
      fileUrl: specSaved.fileUrl,
      storageKey: specSaved.storageKey,
      mimeType: specSaved.mimeType,
      fileSize: specSaved.bytes,
      category: "SPEC",
      entityType: "DEAL",
      entityId: contract.dealId,
      uploadedById: args.userId,
    },
  });

  await args.prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: args.userId,
      source: "USER",
      data: {
        action: "generate_documents",
        contractAttachmentId,
        specAttachmentId,
      },
    },
  });

  return {
    contractPdfUrl: contractSaved.fileUrl,
    specificationPdfUrl: specSaved.fileUrl,
  };
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newShareToken(): string {
  return randomBytes(24).toString("base64url");
}

export function extractContentParts(content: unknown): { fields: Record<string, unknown>; contentJson: ContractContentJson } {
  const contentObj = toObject(content);
  const contentJson = toObject(contentObj.contentJson) as ContractContentJson;
  return {
    fields: toObject(contentJson.fields),
    contentJson,
  };
}

