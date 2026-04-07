import type { LeadDetailRow } from "./queries";

function parseIsoDate(s: string | null | undefined): Date | null {
  if (s == null || s === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseIsoDateRequired(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return new Date(0);
  return d;
}

/**
 * Відновлює `LeadDetailRow` після `GET /api/leads/:id` (JSON з ISO-рядками замість Date).
 */
export function reviveLeadDetailFromJson(raw: unknown): LeadDetailRow {
  if (!raw || typeof raw !== "object") {
    throw new Error("lead: некоректний JSON");
  }
  const o = raw as Record<string, unknown>;

  const estimates = Array.isArray(o.estimates)
    ? o.estimates.map((e) => {
        const x = e as Record<string, unknown>;
        return {
          id: String(x.id),
          name: (x.name as string | null) ?? null,
          version: Number(x.version),
          status: String(x.status),
          totalPrice:
            x.totalPrice === null || x.totalPrice === undefined
              ? null
              : Number(x.totalPrice),
          templateKey: (x.templateKey as string | null) ?? null,
          createdAt: parseIsoDateRequired(String(x.createdAt)),
          updatedAt: parseIsoDateRequired(String(x.updatedAt)),
        };
      })
    : [];

  const proposals = Array.isArray(o.proposals)
    ? o.proposals.map((p) => {
        const x = p as Record<string, unknown>;
        return {
          id: String(x.id),
          version: Number(x.version),
          status: String(x.status),
          estimateId: (x.estimateId as string | null) ?? null,
          estimateVersion:
            x.estimateVersion === null || x.estimateVersion === undefined
              ? null
              : Number(x.estimateVersion),
          sentAt: parseIsoDate(x.sentAt as string | null | undefined),
          approvedAt: parseIsoDate(x.approvedAt as string | null | undefined),
          viewedAt: parseIsoDate(x.viewedAt as string | null | undefined),
          publicToken: (x.publicToken as string | null) ?? null,
          hasPdf: Boolean(x.hasPdf),
          pdfFileUrl: (x.pdfFileUrl as string | null) ?? null,
          hasSnapshot: Boolean(x.hasSnapshot),
          title: (x.title as string | null) ?? null,
          createdAt: parseIsoDateRequired(String(x.createdAt)),
        };
      })
    : [];

  const { estimates: _e, proposals: _p, ...rest } = o;

  return {
    ...(rest as Omit<LeadDetailRow, "estimates" | "proposals">),
    createdAt: parseIsoDateRequired(String(o.createdAt)),
    updatedAt: parseIsoDateRequired(String(o.updatedAt)),
    nextContactAt: parseIsoDate(o.nextContactAt as string | null | undefined),
    lastActivityAt: parseIsoDate(o.lastActivityAt as string | null | undefined),
    estimates,
    proposals,
  } as LeadDetailRow;
}
