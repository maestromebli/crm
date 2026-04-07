import type { Prisma } from "@prisma/client";
import {
  DEFAULT_CONVERT_LEAD_TRANSFER,
  type ConvertLeadToDealInput,
  type ConvertLeadTransferInput,
} from "./convert-lead-to-deal.shared";
import {
  cloneLeadRelatedAttachmentsToDeal,
  syncContactFromLead,
} from "./lead-to-deal-transfer";
import { moveLeadEstimatesToDeal } from "./move-lead-estimates-to-deal";
import { applyCommercialSnapshotFromApprovedProposal } from "../deals/apply-deal-from-proposal";

export type {
  ConvertLeadCommunicationTransfer,
  ConvertLeadDealSetupInput,
  ConvertLeadToDealInput,
  ConvertLeadTransferInput,
} from "./convert-lead-to-deal.shared";
export { DEFAULT_CONVERT_LEAD_TRANSFER } from "./convert-lead-to-deal.shared";

function mergeTransfer(
  partial?: Partial<ConvertLeadTransferInput>,
): ConvertLeadTransferInput {
  const t = partial ?? {};
  return {
    files: { ...DEFAULT_CONVERT_LEAD_TRANSFER.files, ...t.files },
    commercial: {
      ...DEFAULT_CONVERT_LEAD_TRANSFER.commercial,
      ...t.commercial,
    },
    contactIds: t.contactIds ?? DEFAULT_CONVERT_LEAD_TRANSFER.contactIds,
    communication: {
      ...DEFAULT_CONVERT_LEAD_TRANSFER.communication,
      ...t.communication,
    },
  };
}

export type LeadForConversion = {
  id: string;
  title: string;
  note: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  ownerId: string;
  contactId: string | null;
  clientId: string | null;
  contact: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    clientId: string | null;
  } | null;
  leadContacts: Array<{ contactId: string }>;
  activeProposalId: string | null;
  activeEstimateId: string | null;
};

type DefaultStage = { pipelineId: string; stageId: string };

function buildWorkspaceMeta(
  leadId: string,
  transfer: ConvertLeadTransferInput,
  installationDateIso: string | null,
): Prisma.InputJsonValue {
  return {
    conversion: {
      fromLeadId: leadId,
      communicationMode: transfer.communication.mode,
      communicationRecentCount: transfer.communication.recentCount ?? 30,
    },
    executionChecklist: {
      contactConfirmed: false,
      estimateApproved: false,
      contractCreated: false,
      contractSigned: false,
      prepaymentReceived: false,
      productionStarted: false,
      installationScheduled: Boolean(installationDateIso),
    },
    ...(installationDateIso
      ? { installationDate: installationDateIso }
      : {}),
  };
}

export type ConvertLeadToDealTxResult = {
  deal: {
    id: string;
    title: string;
    primaryContactId: string | null;
  };
  filesMigrated: number;
  estimatesMoved: number;
  contactsLinked: number;
};

/**
 * Логіка в одній транзакції: клієнт, контакти, угода, файли, смети, аудит.
 */
export async function convertLeadToDeal(
  tx: Prisma.TransactionClient,
  args: {
    lead: LeadForConversion;
    leadPipelineId: string;
    input: ConvertLeadToDealInput;
    actorId: string;
    dealStage: DefaultStage;
  },
): Promise<ConvertLeadToDealTxResult> {
  const transfer = mergeTransfer(args.input.transfer);
  const setup = args.input.dealSetup ?? {};
  const dealTitle =
    (typeof args.input.dealTitle === "string"
      ? args.input.dealTitle.trim()
      : "") ||
    args.lead.title.trim() ||
    "Угода";

  const installationDate = setup.installationDate?.trim()
    ? new Date(setup.installationDate)
    : null;
  const installationValid =
    installationDate && !Number.isNaN(installationDate.getTime())
      ? installationDate
      : null;

  let clientId = args.lead.clientId ?? args.lead.contact?.clientId ?? null;
  let primaryContactId = args.lead.contactId;

  const displayContactName = () =>
    args.lead.contact?.fullName?.trim() ||
    args.lead.contactName?.trim() ||
    args.lead.title.trim() ||
    "Клієнт";

  const phone =
    args.lead.contact?.phone?.trim() || args.lead.phone?.trim() || null;
  const email =
    args.lead.contact?.email?.trim() || args.lead.email?.trim() || null;

  if (!clientId) {
    const clientName = displayContactName();
    const c = await tx.client.create({
      data: {
        name: clientName,
        type: "PERSON",
      },
    });
    clientId = c.id;

    if (primaryContactId && args.lead.contact) {
      await tx.contact.update({
        where: { id: primaryContactId },
        data: { clientId: c.id },
      });
      await tx.client.update({
        where: { id: c.id },
        data: { primaryContactId },
      });
    } else {
      const fullName =
        args.lead.contact?.fullName?.trim() ||
        args.lead.contactName?.trim() ||
        clientName;
      const contact = await tx.contact.create({
        data: {
          fullName,
          phone,
          email,
          clientId: c.id,
        },
      });
      primaryContactId = contact.id;
      await tx.client.update({
        where: { id: c.id },
        data: { primaryContactId: contact.id },
      });
    }
  } else if (!primaryContactId) {
    const fullName =
      args.lead.contactName?.trim() || args.lead.title.trim() || "Контакт";
    const contact = await tx.contact.create({
      data: {
        fullName,
        phone,
        email,
        clientId,
      },
    });
    primaryContactId = contact.id;
    const cli = await tx.client.findUnique({
      where: { id: clientId },
      select: { primaryContactId: true },
    });
    if (!cli?.primaryContactId) {
      await tx.client.update({
        where: { id: clientId },
        data: { primaryContactId: contact.id },
      });
    }
  } else if (args.lead.contact && !args.lead.contact.clientId) {
    await tx.contact.update({
      where: { id: primaryContactId },
      data: { clientId },
    });
    const cli = await tx.client.findUnique({
      where: { id: clientId },
      select: { primaryContactId: true },
    });
    if (!cli?.primaryContactId) {
      await tx.client.update({
        where: { id: clientId },
        data: { primaryContactId },
      });
    }
  }

  const allowedContactIds = new Set<string>();
  for (const lc of args.lead.leadContacts) {
    allowedContactIds.add(lc.contactId);
  }
  if (primaryContactId) allowedContactIds.add(primaryContactId);

  let selectedContactIds: string[];
  if (transfer.contactIds?.length) {
    selectedContactIds = transfer.contactIds.filter((id) =>
      allowedContactIds.has(id),
    );
  } else {
    selectedContactIds = [...allowedContactIds];
  }

  for (const cid of selectedContactIds) {
    await tx.contact.update({
      where: { id: cid },
      data: { clientId },
    });
  }

  if (primaryContactId && !selectedContactIds.includes(primaryContactId)) {
    primaryContactId = selectedContactIds[0] ?? primaryContactId;
  } else if (!primaryContactId && selectedContactIds.length) {
    primaryContactId = selectedContactIds[0]!;
  }

  if (primaryContactId) {
    await syncContactFromLead(tx, args.lead, primaryContactId);
  }

  const ownerId = setup.ownerId?.trim() || args.lead.ownerId;
  const productionManagerId = setup.productionManagerId?.trim() || null;
  const handoffNote =
    typeof setup.handoffNote === "string" ? setup.handoffNote.trim() : "";

  const meta = buildWorkspaceMeta(
    args.lead.id,
    transfer,
    installationValid ? installationValid.toISOString() : null,
  );

  const deal = await tx.deal.create({
    data: {
      title: dealTitle,
      description: args.lead.note?.trim() || null,
      status: "OPEN",
      pipelineId: args.dealStage.pipelineId,
      stageId: args.dealStage.stageId,
      leadId: args.lead.id,
      clientId: clientId!,
      primaryContactId,
      ownerId,
      productionManagerId,
      installationDate: installationValid,
      workspaceMeta: meta,
    },
  });

  await applyCommercialSnapshotFromApprovedProposal(tx, {
    dealId: deal.id,
    baseWorkspaceMeta: meta,
    activeProposalId: args.lead.activeProposalId,
  });

  if (handoffNote) {
    await tx.dealHandoff.create({
      data: {
        dealId: deal.id,
        status: "DRAFT",
        notes: handoffNote,
      },
    });
  }

  const archiveStage = await tx.pipelineStage.findFirst({
    where: { pipelineId: args.leadPipelineId, slug: "archived" },
    select: { id: true },
  });
  const lostFallback = archiveStage
    ? null
    : await tx.pipelineStage.findFirst({
        where: {
          pipelineId: args.leadPipelineId,
          slug: "lost",
          isFinal: true,
        },
        select: { id: true },
      });
  const archiveStageId = archiveStage?.id ?? lostFallback?.id;

  await tx.lead.update({
    where: { id: args.lead.id },
    data: {
      dealId: deal.id,
      clientId: clientId!,
      contactId: primaryContactId,
      ...(archiveStageId ? { stageId: archiveStageId } : {}),
    },
  });

  const fileGroups = transfer.files;
  const anyFileGroup =
    fileGroups.measurements ||
    fileGroups.renders ||
    fileGroups.proposalPdf ||
    fileGroups.others;

  let filesMigrated = 0;
  if (anyFileGroup) {
    filesMigrated = await cloneLeadRelatedAttachmentsToDeal(tx, {
      dealId: deal.id,
      leadId: args.lead.id,
      contactId: primaryContactId,
      clientId: clientId!,
      uploadedById: args.actorId,
      fileGroups,
      forceLastProposalPdf:
        transfer.commercial.lastProposal && !fileGroups.proposalPdf,
    });
  }

  const estimatesMoved = await moveLeadEstimatesToDeal(
    tx,
    args.lead.id,
    deal.id,
    {
      enabled: transfer.commercial.currentEstimate,
      includeDrafts: transfer.commercial.drafts,
    },
  );

  await tx.leadConversionAudit.upsert({
    where: { leadId: args.lead.id },
    create: {
      leadId: args.lead.id,
      dealId: deal.id,
      convertedById: args.actorId,
      activeEstimateIdUsed: args.lead.activeEstimateId,
      approvedProposalIdUsed: args.lead.activeProposalId,
      migratedFilesCount: filesMigrated,
      migratedContactsCount: selectedContactIds.length,
      migratedMessagesCount: 0,
      checklistSnapshot: transfer as unknown as Prisma.InputJsonValue,
      warningsAtConversion: {
        communication: transfer.communication,
      } as unknown as Prisma.InputJsonValue,
    },
    update: {
      dealId: deal.id,
      convertedById: args.actorId,
      activeEstimateIdUsed: args.lead.activeEstimateId,
      approvedProposalIdUsed: args.lead.activeProposalId,
      migratedFilesCount: filesMigrated,
      migratedContactsCount: selectedContactIds.length,
      migratedMessagesCount: 0,
      checklistSnapshot: transfer as unknown as Prisma.InputJsonValue,
      warningsAtConversion: {
        communication: transfer.communication,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    deal: {
      id: deal.id,
      title: deal.title,
      primaryContactId,
    },
    filesMigrated,
    estimatesMoved,
    contactsLinked: selectedContactIds.length,
  };
}
