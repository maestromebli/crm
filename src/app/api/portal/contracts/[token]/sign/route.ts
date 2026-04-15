import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashShareToken } from "@/lib/contracts/service";

type Ctx = { params: Promise<{ token: string }> };

function providerMode() {
  const mode = process.env.SIGNATURE_PROVIDER?.trim().toLowerCase();
  return mode === "diia" ? "diia" : "mock";
}

export async function POST(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const tokenHash = hashShareToken(token);
  const share = await (prisma as any).contractShareLink.findUnique({
    where: { tokenHash },
    include: { contract: true },
  });
  if (!share) return NextResponse.json({ error: "Посилання не знайдено" }, { status: 404 });
  if (share.status !== "ACTIVE") return NextResponse.json({ error: "Посилання неактивне" }, { status: 410 });

  let contractVersionId = share.contract.currentVersionId;
  if (!contractVersionId) {
    const createdVersion = await prisma.dealContractVersion.create({
      data: {
        contractId: share.contractId,
        revision: Math.max(1, share.contract.version),
        lifecycleStatus: share.contract.status,
        templateKey: share.contract.templateKey,
        content: share.contract.content as object,
      },
      select: { id: true },
    });
    contractVersionId = createdVersion.id;
    await prisma.dealContract.update({
      where: { id: share.contractId },
      data: { currentVersionId: createdVersion.id },
    });
  }

  const providerRequestId = `contract-${providerMode()}-${randomBytes(8).toString("hex")}`;
  const request = await prisma.signatureRequest.create({
    data: {
      contractVersionId,
      provider: "DIIA",
      providerRequestId,
      status: "IN_PROGRESS",
      expiresAt: share.expiresAt,
      legacyDiiaSessionId: providerRequestId,
    },
  });

  await prisma.dealContract.update({
    where: { id: share.contractId },
    data: {
      status: "SENT_FOR_SIGNATURE",
      diiaSessionId: request.legacyDiiaSessionId,
    },
  });
  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: share.contract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: null,
      source: "INTEGRATION",
      data: {
        action: "portal_sign_start",
        status: "SENT_FOR_SIGNATURE",
        signatureRequestId: request.id,
        provider: providerMode(),
      },
    },
  });

  const signingUrl =
    providerMode() === "diia"
      ? `https://diia.example/sign/${request.providerRequestId}`
      : `/api/integrations/diia/webhook?mockSession=${request.providerRequestId}`;

  return NextResponse.json({
    ok: true,
    data: {
      sessionId: request.providerRequestId,
      signingUrl,
      provider: providerMode(),
    },
  });
}
