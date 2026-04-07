import { Prisma } from "@prisma/client";

/**
 * Поля картки ліда (Hub), які бажано підвантажити з `LeadProposal`.
 * Якщо згенерований Prisma Client старий — у `select` потраплять лише ті поля,
 * що реально є в `LeadProposalScalarFieldEnum` (інакше PrismaClientValidationError).
 */
const HUB_SCALAR_FIELDS = [
  "id",
  "version",
  "status",
  "estimateId",
  "sentAt",
  "approvedAt",
  "viewedAt",
  "publicToken",
  "pdfAttachmentId",
  "title",
  "createdAt",
  "snapshotJson",
] as const;

export function buildLeadProposalHubSelect(): Prisma.LeadProposalSelect {
  const en = Prisma.LeadProposalScalarFieldEnum as
    | Record<string, unknown>
    | undefined;

  const select: Record<
    string,
    boolean | { select: Record<string, boolean> }
  > = {
    estimate: { select: { version: true } },
    pdfAttachment: { select: { fileUrl: true, fileName: true } },
  };

  if (!en || typeof en !== "object") {
    return {
      ...select,
      id: true,
      version: true,
      status: true,
      estimateId: true,
      createdAt: true,
    } as Prisma.LeadProposalSelect;
  }

  for (const f of HUB_SCALAR_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(en, f)) {
      select[f] = true;
    }
  }

  return select as Prisma.LeadProposalSelect;
}

/** Мапінг рядка з динамічного select у стабільний контракт для UI. */
export function mapLeadProposalHubRowToSummary(p: unknown): {
  id: string;
  version: number;
  status: string;
  estimateId: string | null;
  estimateVersion: number | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  viewedAt: Date | null;
  publicToken: string | null;
  hasPdf: boolean;
  /** Відносний URL файлу (`/uploads/...`), якщо PDF згенеровано. */
  pdfFileUrl: string | null;
  hasSnapshot: boolean;
  title: string | null;
  createdAt: Date;
} {
  const r = p as Record<string, unknown>;
  const estimate = r.estimate as { version: number } | null | undefined;
  const pdfAtt = r.pdfAttachment as
    | { fileUrl: string; fileName?: string | null }
    | null
    | undefined;

  return {
    id: r.id as string,
    version: r.version as number,
    status: r.status as string,
    estimateId: (r.estimateId ?? null) as string | null,
    estimateVersion: estimate?.version ?? null,
    sentAt: (r.sentAt ?? null) as Date | null,
    approvedAt: (r.approvedAt ?? null) as Date | null,
    viewedAt: (r.viewedAt ?? null) as Date | null,
    publicToken: (r.publicToken ?? null) as string | null,
    hasPdf: Boolean(r.pdfAttachmentId),
    pdfFileUrl:
      typeof pdfAtt?.fileUrl === "string" && pdfAtt.fileUrl.trim()
        ? pdfAtt.fileUrl.trim()
        : null,
    hasSnapshot: r.snapshotJson != null,
    title: (r.title ?? null) as string | null,
    createdAt: r.createdAt as Date,
  };
}
