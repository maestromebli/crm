import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { updateContractVariablesSchema } from "@/features/contracts/schemas/contract.schema";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { mapContractDetails } from "@/lib/contracts/service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

function normalizeLegacyContractStatus(status: string): string {
  if (status === "VIEWED_BY_CUSTOMER") return "VIEWED_BY_CLIENT";
  if (status === "SENT_TO_CUSTOMER") return "SENT_FOR_SIGNATURE";
  return status;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_VIEW);
  if (denied) return denied;

  const { id } = await ctx.params;
  const enverContract = await prisma.enverContract.findUnique({
    where: { id },
    include: {
      parties: true,
      sessions: { orderBy: { createdAt: "desc" } },
      artifacts: true,
      auditEvents: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (enverContract) {
    return NextResponse.json(enverContract);
  }

  const legacyContract = await prisma.dealContract.findUnique({
    where: { id },
  });
  if (!legacyContract) {
    return NextResponse.json({ error: "CONTRACT_NOT_FOUND" }, { status: 404 });
  }

  const details = mapContractDetails(legacyContract);
  const documents = await prisma.attachment.findMany({
    where: {
      entityType: "DEAL",
      entityId: legacyContract.dealId,
      deletedAt: null,
      category: { in: ["CONTRACT", "SPEC"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      category: true,
      createdAt: true,
    },
  });
  const auditRows = await prisma.activityLog.findMany({
    where: {
      entityType: "DEAL",
      entityId: legacyContract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      type: true,
      data: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      ...details,
      status: normalizeLegacyContractStatus(details.status),
      documents: documents.map((doc) => ({
        id: doc.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        type: doc.category,
        createdAt: doc.createdAt.toISOString(),
      })),
      audit: auditRows.map((row) => ({
        action: row.type,
        payload:
          row.data && typeof row.data === "object"
            ? (row.data as Record<string, unknown>)
            : {},
        createdAt: row.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contract = await prisma.enverContract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "CONTRACT_NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateContractVariablesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.enverContract.update({
    where: { id },
    data: {
      payloadJson: parsed.data.payloadJson as Prisma.InputJsonValue,
      status: "READY_FOR_REVIEW",
      auditEvents: {
        create: {
          eventType: "CONTRACT_UPDATED",
          metadataJson: {
            keys: Object.keys(parsed.data.payloadJson),
          } as Prisma.InputJsonValue,
        },
      },
    },
  });
  return NextResponse.json(updated);
}
