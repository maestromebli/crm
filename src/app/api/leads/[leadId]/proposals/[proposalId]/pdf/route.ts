import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { renderLeadProposalPdfFromModel } from "@/lib/estimates/render-lead-proposal-pdf";
import { buildQuotePrintModelFromEntities } from "@/lib/leads/lead-proposal-document";
import { prisma } from "@/lib/prisma";
import { saveLeadBufferPrivate } from "@/lib/uploads/lead-disk-upload";

type Ctx = { params: Promise<{ leadId: string; proposalId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId, proposalId } = await ctx.params;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true, title: true },
  });
  if (!lead || lead.dealId) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  const proposal = await prisma.leadProposal.findFirst({
    where: { id: proposalId, leadId },
    include: {
      estimate: {
        include: {
          lineItems: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!proposal) {
    return NextResponse.json({ error: "КП не знайдено" }, { status: 404 });
  }

  const est = proposal.estimate;
  const docModel = buildQuotePrintModelFromEntities({
    leadTitle: lead.title,
    proposal: {
      title: proposal.title,
      version: proposal.version,
      createdAt: proposal.createdAt,
      summary: proposal.summary,
      notes: proposal.notes,
      snapshotJson: proposal.snapshotJson,
      visualizationUrl: proposal.visualizationUrl,
    },
    estimate: est
      ? {
          name: est.name,
          templateKey: est.templateKey,
          version: est.version,
          totalPrice: est.totalPrice,
          discountAmount: est.discountAmount,
          deliveryCost: est.deliveryCost,
          installationCost: est.installationCost,
          lineItems: est.lineItems.map((li) => ({
            id: li.id,
            type: li.type,
            category: li.category,
            productName: li.productName,
            qty: li.qty,
            unit: li.unit,
            salePrice: li.salePrice,
            amountSale: li.amountSale,
            metadataJson: li.metadataJson ?? undefined,
          })),
        }
      : null,
  });

  const pdfBytes = await renderLeadProposalPdfFromModel(docModel);

  const buf = Buffer.from(pdfBytes);
  const pdfAttachmentId = randomUUID();
  const saved = await saveLeadBufferPrivate({
    leadId,
    attachmentId: pdfAttachmentId,
    buffer: buf,
    fileName: `kp-v${proposal.version}.pdf`,
    mimeType: "application/pdf",
  });

  const token =
    proposal.publicToken ??
    randomBytes(18).toString("base64url").replace(/=/g, "");

  const att = await prisma.attachment.create({
    data: {
      id: pdfAttachmentId,
      fileName: saved.originalName,
      fileUrl: saved.fileUrl,
      storageKey: saved.storageKey,
      mimeType: saved.mimeType,
      fileSize: saved.bytes,
      category: "QUOTE_PDF",
      entityType: "LEAD",
      entityId: leadId,
      uploadedById: user.id,
    },
  });

  await prisma.leadProposal.update({
    where: { id: proposal.id },
    data: {
      pdfAttachmentId: att.id,
      publicToken: token,
    },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/pricing`);

  return NextResponse.json({
    ok: true,
    pdfUrl: saved.fileUrl,
    publicPath: `/p/${token}`,
    publicToken: token,
  });
}
