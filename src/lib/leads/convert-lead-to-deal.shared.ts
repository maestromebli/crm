/**
 * Типи та дефолти конверсії лід → угода (без імпорту Prisma/pg — безпечно для client components).
 */

export type LeadFileTransferGroups = {
  measurements: boolean;
  renders: boolean;
  proposalPdf: boolean;
  others: boolean;
};

export type ConvertLeadCommunicationTransfer = {
  mode: "full" | "recent";
  recentCount?: number;
};

export type ConvertLeadTransferInput = {
  files: LeadFileTransferGroups;
  commercial: {
    currentEstimate: boolean;
    lastProposal: boolean;
    drafts: boolean;
  };
  /** null — усі контакти ліда + основний. */
  contactIds: string[] | null;
  communication: ConvertLeadCommunicationTransfer;
};

export type ConvertLeadDealSetupInput = {
  ownerId: string | null;
  productionManagerId: string | null;
  installationDate: string | null;
  /** Короткий текст для виробництва / виконання (зберігається в DealHandoff.notes). */
  handoffNote: string | null;
};

export type ConvertLeadToDealInput = {
  dealTitle?: string | null;
  transfer?: Partial<ConvertLeadTransferInput>;
  dealSetup?: Partial<ConvertLeadDealSetupInput>;
};

export const DEFAULT_CONVERT_LEAD_TRANSFER: ConvertLeadTransferInput = {
  files: {
    measurements: true,
    renders: true,
    proposalPdf: true,
    others: true,
  },
  commercial: {
    currentEstimate: true,
    lastProposal: true,
    drafts: false,
  },
  contactIds: null,
  communication: { mode: "full", recentCount: 30 },
};
