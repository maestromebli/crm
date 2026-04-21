import type { AttachmentCategory, Prisma } from "@prisma/client";
import type { LeadFileTransferGroups } from "./convert-lead-to-deal.shared";

export type { LeadFileTransferGroups } from "./convert-lead-to-deal.shared";

const MEASUREMENT_CATS = new Set<AttachmentCategory>([
  "MEASUREMENT_SHEET",
  "CALCULATION",
]);
const RENDER_CATS = new Set<AttachmentCategory>([
  "DRAWING",
  "OBJECT_PHOTO",
  "RESULT_PHOTO",
]);

function categoryMatchesGroups(
  category: AttachmentCategory,
  groups: LeadFileTransferGroups,
  forceProposalPdf: boolean,
): boolean {
  if (forceProposalPdf && category === "QUOTE_PDF") return true;
  if (groups.measurements && MEASUREMENT_CATS.has(category)) return true;
  if (groups.renders && RENDER_CATS.has(category)) return true;
  if (groups.proposalPdf && category === "QUOTE_PDF") return true;
  if (groups.others) {
    if (
      MEASUREMENT_CATS.has(category) ||
      RENDER_CATS.has(category) ||
      category === "QUOTE_PDF"
    ) {
      return false;
    }
    return true;
  }
  return false;
}

type LeadForTransfer = {
  id: string;
  title: string;
  note: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  contact: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  } | null;
};

function displayContactName(lead: LeadForTransfer): string {
  return (
    lead.contact?.fullName?.trim() ||
    lead.contactName?.trim() ||
    lead.title.trim() ||
    "Клієнт"
  );
}

const CATEGORY_PRIORITY: Partial<Record<AttachmentCategory, number>> = {
  MEASUREMENT_SHEET: 0,
  CALCULATION: 1,
  QUOTE_PDF: 2,
  DRAWING: 3,
  OBJECT_PHOTO: 4,
  BRIEF: 5,
  REFERENCE: 6,
  OTHER: 99,
};

function categorySortOrder(c: AttachmentCategory): number {
  return CATEGORY_PRIORITY[c] ?? 50;
}

/**
 * Переносить актуальні поля ліда в картку контакту (імʼя, телефон, email, нотатка).
 */
export async function syncContactFromLead(
  tx: Prisma.TransactionClient,
  lead: LeadForTransfer,
  contactId: string,
): Promise<void> {
  const phone =
    lead.contact?.phone?.trim() || lead.phone?.trim() || null;
  const email =
    lead.contact?.email?.trim() || lead.email?.trim() || null;

  const cur = await tx.contact.findUnique({
    where: { id: contactId },
    select: { notes: true },
  });

  let notes: string | undefined;
  if (lead.note?.trim()) {
    const block = `З ліда: ${lead.note.trim()}`;
    notes = cur?.notes?.trim()
      ? `${cur.notes.trim()}\n\n--- ${block}`
      : block;
  }

  await tx.contact.update({
    where: { id: contactId },
    data: {
      fullName: displayContactName(lead),
      ...(phone ? { phone } : {}),
      ...(email !== null && email !== "" ? { email } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
  });
}

/**
 * Копії вкладень (поточні версії) на замовлення: новий FileAsset + Attachment для кожного файлу.
 * Джерела: лід, контакт, клієнт. Категорії замір/розрахунок/КП йдуть першими.
 * Важливо: переносимо кожне завантаження окремо без дедуплікації, щоб у файлах замовлення
 * відображалися всі файли, які були завантажені під лід.
 */
export async function cloneLeadRelatedAttachmentsToDeal(
  tx: Prisma.TransactionClient,
  opts: {
    dealId: string;
    leadId: string;
    contactId: string | null;
    clientId: string;
    uploadedById: string;
    /** Якщо задано — копіюються лише обрані групи; інакше всі категорії (як раніше). */
    fileGroups?: LeadFileTransferGroups | null;
    /** Якщо true разом із lastProposal — КП (PDF) завжди враховується. */
    forceLastProposalPdf?: boolean;
  },
): Promise<number> {
  const or: Prisma.AttachmentWhereInput[] = [
    { entityType: "LEAD", entityId: opts.leadId },
  ];
  if (opts.contactId) {
    or.push({ entityType: "CONTACT", entityId: opts.contactId });
  }
  or.push({ entityType: "CLIENT", entityId: opts.clientId });

  const rows = await tx.attachment.findMany({
    where: {
      deletedAt: null,
      isCurrentVersion: true,
      dealContractVersionId: null,
      signatureRequestId: null,
      OR: or,
    },
    orderBy: [{ createdAt: "asc" }],
  });

  rows.sort(
    (a, b) =>
      categorySortOrder(a.category) - categorySortOrder(b.category) ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const filter =
    opts.fileGroups != null
      ? (cat: AttachmentCategory) =>
          categoryMatchesGroups(
            cat,
            opts.fileGroups!,
            Boolean(opts.forceLastProposalPdf),
          )
      : null;

  let n = 0;
  for (const src of rows) {
    if (filter && !filter(src.category)) continue;

    const fa = await tx.fileAsset.create({
      data: {
        dealId: opts.dealId,
        category: src.category,
        displayName: src.fileName,
      },
    });
    await tx.attachment.create({
      data: {
        fileName: src.fileName,
        fileUrl: src.fileUrl,
        mimeType: src.mimeType,
        fileSize: src.fileSize,
        category: src.category,
        entityType: "DEAL",
        entityId: opts.dealId,
        uploadedById: opts.uploadedById,
        fileAssetId: fa.id,
        version: 1,
        isCurrentVersion: true,
        source: "SYSTEM",
        contentHash: src.contentHash,
        storageKey: src.storageKey,
      },
    });
    n += 1;
  }

  return n;
}
