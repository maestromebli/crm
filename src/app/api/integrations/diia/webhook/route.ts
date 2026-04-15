import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type WebhookBody = {
  sessionId?: string;
  status?: string;
  event?: string;
  data?: Record<string, unknown>;
};

function resolveStatus(input: string): {
  signature: "IN_PROGRESS" | "COMPLETED" | "DECLINED" | "EXPIRED";
  contract: "SENT_FOR_SIGNATURE" | "CLIENT_SIGNED" | "FULLY_SIGNED" | "DECLINED" | "EXPIRED";
} | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "viewed" || raw === "in_progress") {
    return { signature: "IN_PROGRESS", contract: "SENT_FOR_SIGNATURE" };
  }
  if (raw === "signed" || raw === "client_signed") {
    return { signature: "COMPLETED", contract: "CLIENT_SIGNED" };
  }
  if (raw === "fully_signed" || raw === "completed") {
    return { signature: "COMPLETED", contract: "FULLY_SIGNED" };
  }
  if (raw === "declined" || raw === "rejected") {
    return { signature: "DECLINED", contract: "DECLINED" };
  }
  if (raw === "expired") {
    return { signature: "EXPIRED", contract: "EXPIRED" };
  }
  return null;
}

export async function POST(req: Request) {
  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const sessionId = (body.sessionId ?? "").trim();
  if (!sessionId) return NextResponse.json({ error: "Потрібно передати sessionId" }, { status: 400 });

  const resolved = resolveStatus((body.status ?? body.event ?? "").toString());
  if (!resolved) return NextResponse.json({ ok: true, ignored: true });

  const requestRow = await prisma.signatureRequest.findFirst({
    where: {
      OR: [{ providerRequestId: sessionId }, { legacyDiiaSessionId: sessionId }],
    },
    include: {
      contractVersion: {
        include: {
          contract: true,
        },
      },
    },
  });
  if (!requestRow) {
    return NextResponse.json({ error: "Сесію підпису не знайдено" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: requestRow.id },
      data: { status: resolved.signature },
    }),
    prisma.dealContract.update({
      where: { id: requestRow.contractVersion.contractId },
      data: {
        status: resolved.contract,
      },
    }),
    prisma.signatureProviderEvent.create({
      data: {
        signatureRequestId: requestRow.id,
        providerEventId: `${sessionId}:${Date.now()}`,
        payload: (body.data ?? body) as Prisma.InputJsonValue,
      },
    }),
    prisma.activityLog.create({
      data: {
        entityType: "DEAL",
        entityId: requestRow.contractVersion.contract.dealId,
        type: "CONTRACT_STATUS_CHANGED",
        actorUserId: null,
        source: "INTEGRATION",
        data: {
          action: "diia_webhook",
          incomingStatus: body.status ?? body.event ?? null,
          resolvedContractStatus: resolved.contract,
          sessionId,
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      signatureStatus: resolved.signature,
      contractStatus: resolved.contract,
      contractId: requestRow.contractVersion.contractId,
    },
  });
}
