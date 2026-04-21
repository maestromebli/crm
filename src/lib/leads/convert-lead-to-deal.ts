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
import { allocateDealNumber } from "../deals/deal-number";

export type {
  ConvertLeadCommunicationTransfer,
  ConvertLeadDealSetupInput,
  ConvertLeadToDealInput,
  ConvertLeadTransferInput,
} from "./convert-lead-to-deal.shared";
export { DEFAULT_CONVERT_LEAD_TRANSFER } from "./convert-lead-to-deal.shared";

async function safeUpdateContactClientId(
  tx: Prisma.TransactionClient,
  contactId: string,
  clientId: string,
): Promise<void> {
  try {
    await tx.$executeRawUnsafe(
      `UPDATE "Contact" SET "clientId" = $1 WHERE "id" = $2`,
      clientId,
      contactId,
    );
  } catch (error) {
    const maybePrisma = error as { code?: string } | null;
    if (maybePrisma?.code !== "P2022") throw error;
    // Legacy DB schema: не блокуємо конверсію через контактні поля.
  }
}

async function canUsePrismaContactWrites(
  tx: Prisma.TransactionClient,
): Promise<boolean> {
  try {
    const rows = await tx.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('Contact', 'contact')
    `;
    const names = new Set(rows.map((r) => r.column_name));
    return names.has("category");
  } catch {
    return false;
  }
}

async function getDealColumnNames(
  tx: Prisma.TransactionClient,
): Promise<Set<string>> {
  try {
    const rows = await tx.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('Deal', 'deal')
    `;
    return new Set(rows.map((r) => r.column_name));
  } catch {
    // Якщо introspection недоступний, покладаємось на актуальну Prisma-схему.
    return new Set<string>();
  }
}

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
  dealNumber: string,
): Prisma.InputJsonValue {
  return {
    dealNumber,
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
 * Логіка в одній транзакції: клієнт, контакти, замовлення, файли, смети, аудит.
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
  const prismaContactWritesEnabled = await canUsePrismaContactWrites(tx);
  const dealColumnNames = await getDealColumnNames(tx);
  const transfer = mergeTransfer(args.input.transfer);
  const setup = args.input.dealSetup ?? {};
  const dealTitle =
    (typeof args.input.dealTitle === "string"
      ? args.input.dealTitle.trim()
      : "") ||
    args.lead.title.trim() ||
    "Замовлення";

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
      await safeUpdateContactClientId(tx, primaryContactId, c.id);
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
    await safeUpdateContactClientId(tx, primaryContactId, clientId);
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
    await safeUpdateContactClientId(tx, cid, clientId);
  }

  if (primaryContactId && !selectedContactIds.includes(primaryContactId)) {
    primaryContactId = selectedContactIds[0] ?? primaryContactId;
  } else if (!primaryContactId && selectedContactIds.length) {
    primaryContactId = selectedContactIds[0]!;
  }

  // У legacy-схемі Contact Prisma update може падати через відсутні колонки.
  // Не блокуємо конверсію ліда в замовлення через синхронізацію додаткових полів контакту.
  if (primaryContactId && prismaContactWritesEnabled) {
    await syncContactFromLead(tx, args.lead, primaryContactId);
  }

  const ownerId = setup.ownerId?.trim() || args.lead.ownerId;
  const productionManagerId = setup.productionManagerId?.trim() || null;
  const handoffNote =
    typeof setup.handoffNote === "string" ? setup.handoffNote.trim() : "";

  const dealNumber = await allocateDealNumber(tx);
  const meta = buildWorkspaceMeta(
    args.lead.id,
    transfer,
    installationValid ? installationValid.toISOString() : null,
    dealNumber,
  );

  const supportsColumn = (name: string): boolean =>
    dealColumnNames.size === 0 || dealColumnNames.has(name);

  const dealCreateData: Prisma.DealCreateInput = {
    title: dealTitle,
    description: args.lead.note?.trim() || null,
    status: "OPEN",
    pipeline: { connect: { id: args.dealStage.pipelineId } },
    stage: { connect: { id: args.dealStage.stageId } },
    lead: { connect: { id: args.lead.id } },
    client: { connect: { id: clientId! } },
    ...(primaryContactId
      ? { primaryContact: { connect: { id: primaryContactId } } }
      : {}),
    owner: { connect: { id: ownerId } },
    ...(supportsColumn("productionManagerId") && productionManagerId
      ? { productionManager: { connect: { id: productionManagerId } } }
      : {}),
    ...(supportsColumn("installationDate") && installationValid
      ? { installationDate: installationValid }
      : {}),
    ...(supportsColumn("workspaceMeta") ? { workspaceMeta: meta } : {}),
  };

  const deal = await tx.deal.create({ data: dealCreateData });

  if (transfer.commercial.lastProposal) {
    await applyCommercialSnapshotFromApprovedProposal(tx, {
      dealId: deal.id,
      baseWorkspaceMeta: meta,
      activeProposalId: args.lead.activeProposalId,
    });
  }

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
  const approvedFallback = archiveStage
    ? null
    : await tx.pipelineStage.findFirst({
        where: {
          pipelineId: args.leadPipelineId,
          slug: "approved",
        },
        select: { id: true },
      });
  const lostFallback = archiveStage || approvedFallback
    ? null
    : await tx.pipelineStage.findFirst({
        where: {
          pipelineId: args.leadPipelineId,
          slug: "lost",
          isFinal: true,
        },
        select: { id: true },
      });
  const archiveStageId =
    archiveStage?.id ?? approvedFallback?.id ?? lostFallback?.id;

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
        migrationResult: {
          filesMigrated,
          estimatesMoved,
          contactsLinked: selectedContactIds.length,
        },
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
        migrationResult: {
          filesMigrated,
          estimatesMoved,
          contactsLinked: selectedContactIds.length,
        },
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
