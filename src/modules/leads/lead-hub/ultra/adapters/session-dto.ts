import type { SessionUser } from "@/lib/authz/api-guard";
import { P, hasEffectivePermission } from "@/lib/authz/permissions";
import type { LeadHubSessionDto } from "../domain/types";

type FullSessionPayload = {
  id: string;
  title: string | null;
  status: "DRAFT" | "ACTIVE" | "CONVERTED" | "ARCHIVED";
  previewImage: string | null;
  createdAt: Date;
  updatedAt: Date;
  pricingSession: {
    id: string;
    currency: string;
    activeVersion: {
      id: string;
      totalsJson: unknown;
      summaryJson: unknown;
      items: Array<{
        id: string;
        name: string;
        quantity: number;
        inputJson: unknown;
        resultJson: unknown;
      }>;
    } | null;
  };
  files: Array<{
    id: string;
    role: string;
    attachment: {
      fileName: string;
      fileUrl: string;
      mimeType: string;
      createdAt: Date;
    };
  }>;
};

export function toLeadHubSessionDto(
  session: FullSessionPayload,
  user: SessionUser,
): LeadHubSessionDto {
  const canViewMargin = hasEffectivePermission(user.permissionKeys, P.MARGIN_VIEW, {
    realRole: user.realRole,
    impersonatorId: user.impersonatorId,
  });

  const totals = (session.pricingSession.activeVersion?.totalsJson ?? {
    totalCost: 0,
    totalRevenue: 0,
    grossProfit: 0,
    marginPercent: 0,
    riskLevel: "low",
  }) as LeadHubSessionDto["totals"];

  const summary = (session.pricingSession.activeVersion?.summaryJson ?? {
    itemCount: 0,
    warningCount: 0,
    topRiskItems: [],
  }) as LeadHubSessionDto["summary"];

  const items = (session.pricingSession.activeVersion?.items ?? []).map((item) => {
    const input = (item.inputJson ?? {}) as {
      unitCost?: number;
      unitPrice?: number;
      category?: string;
      note?: string;
    };
    const result = (item.resultJson ?? {}) as {
      lineCost?: number;
      lineRevenue?: number;
      lineMargin?: number;
      lineMarginPercent?: number;
      warnings?: string[];
    };

    return {
      id: item.id,
      name: item.name,
      quantity: Number(item.quantity ?? 0),
      unitCost: Number(input.unitCost ?? 0),
      unitPrice: Number(input.unitPrice ?? 0),
      category: input.category,
      note: input.note,
      lineCost: Number(result.lineCost ?? 0),
      lineRevenue: Number(result.lineRevenue ?? 0),
      lineMargin: canViewMargin ? Number(result.lineMargin ?? 0) : undefined,
      lineMarginPercent: canViewMargin
        ? Number(result.lineMarginPercent ?? 0)
        : undefined,
      warnings: result.warnings ?? [],
    };
  });

  return {
    id: session.id,
    title: session.title,
    status: session.status,
    previewImage: session.previewImage,
    pricingSessionId: session.pricingSession.id,
    currency: session.pricingSession.currency,
    canViewMargin,
    totals: {
      totalCost: Number(totals.totalCost ?? 0),
      totalRevenue: Number(totals.totalRevenue ?? 0),
      grossProfit: canViewMargin ? Number(totals.grossProfit ?? 0) : 0,
      marginPercent: canViewMargin ? Number(totals.marginPercent ?? 0) : 0,
      riskLevel: totals.riskLevel ?? "low",
    },
    summary,
    items,
    files: session.files.map((file) => ({
      id: file.id,
      role: file.role as "IMAGE" | "CALC_SOURCE" | "DOC",
      fileName: file.attachment.fileName,
      fileUrl: file.attachment.fileUrl,
      mimeType: file.attachment.mimeType,
      createdAt: file.attachment.createdAt.toISOString(),
    })),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}
