import type { Prisma, PrismaClient } from "@prisma/client";
import { canIssue } from "../lib/contract-status";
import { freezeContractSnapshot } from "./freeze-contract-snapshot";
import { renderContractHtml } from "./render-contract-html";
import { renderContractPdf } from "./render-contract-pdf";

export async function issueContract(input: {
  prisma: PrismaClient;
  contractId: string;
  actorId?: string;
  upload: (fileName: string, buffer: Buffer, contentType: string) => Promise<string>;
}) {
  const contract = await input.prisma.enverContract.findUnique({
    where: { id: input.contractId },
    include: { parties: true },
  });
  if (!contract) throw new Error("CONTRACT_NOT_FOUND");
  if (!canIssue(contract.status)) throw new Error("CONTRACT_STATUS_INVALID_FOR_ISSUE");
  if (!contract.parties.length) throw new Error("CONTRACT_PARTIES_MISSING");

  const template = await input.prisma.enverContractTemplate.findUnique({
    where: { id: contract.templateId },
  });
  if (!template?.bodyHtml) throw new Error("TEMPLATE_BODY_MISSING");

  const snapshot = freezeContractSnapshot({
    payloadJson: contract.payloadJson as Record<string, unknown>,
    order: (contract.payloadJson as { order?: Record<string, unknown> }).order ?? {},
  });

  const { html, hash } = renderContractHtml(template.bodyHtml, snapshot.payloadJson);
  const pdf = await renderContractPdf({
    html,
    upload: input.upload,
    contractNumber: contract.contractNumber,
  });

  return input.prisma.enverContract.update({
    where: { id: contract.id },
    data: {
      status: "ISSUED",
      issuedAt: new Date(),
      payloadJson: snapshot.payloadJson as Prisma.InputJsonValue,
      pricingSnapshotJson: snapshot.pricingSnapshotJson as Prisma.InputJsonValue,
      renderedHtmlHash: hash,
      renderedPdfUrl: pdf.url,
      renderedPdfHash: pdf.hash,
      updatedById: input.actorId,
      auditEvents: {
        create: {
          eventType: "CONTRACT_ISSUED",
          actorId: input.actorId,
          actorType: "USER",
          metadataJson: { renderedPdfUrl: pdf.url },
        },
      },
    },
  });
}
