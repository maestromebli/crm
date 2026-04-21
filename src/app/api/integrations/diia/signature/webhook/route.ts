import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { DealContractStatus } from "@prisma/client";
import { prisma } from "../../../../../../lib/prisma";
import { markPrimaryContactCustomerOnContractFullySigned } from "../../../../../../lib/contacts/mark-contact-customer";
import { appendActivityLog } from "../../../../../../lib/deal-api/audit";
import { persistReadinessSnapshot } from "../../../../../../lib/deal-api/persist-readiness";
import { dispatchDealAutomationTrigger } from "../../../../../../lib/automation/dispatch";
import { closeDiiaSignatureStaleTasks } from "../../../../../../lib/diia/signature-stale-task";
import { seedDealPaymentPlan7030 } from "../../../../../../lib/deals/payment-milestones";

type WebhookBody = {
  sessionId?: string;
  event?: string;
  status?: string;
  providerEventId?: string;
};

type DiiaEventLogItem = {
  at: string;
  incomingEvent: string | null;
  incomingStatus: string | null;
  resolvedStatus: DealContractStatus;
  providerEventId: string | null;
};

function verifyWebhookSecret(req: Request): NextResponse | null {
  const configuredSecret = process.env.DIIA_WEBHOOK_SECRET?.trim();
  const incomingSecret = req.headers.get("x-diia-webhook-secret")?.trim() ?? "";
  if (!configuredSecret) {
    return NextResponse.json(
      { error: "DIIA_WEBHOOK_SECRET не задано" },
      { status: 503 },
    );
  }

  const left = Buffer.from(incomingSecret);
  const right = Buffer.from(configuredSecret);
  if (
    left.length !== right.length ||
    !timingSafeEqual(left, right)
  ) {
    return NextResponse.json({ error: "Заборонено" }, { status: 403 });
  }
  return null;
}

function readDiiaEvents(content: unknown): DiiaEventLogItem[] {
  const contentRaw = content && typeof content === "object" && !Array.isArray(content)
    ? (content as Record<string, unknown>)
    : {};
  const contentJsonRaw =
    contentRaw.contentJson &&
    typeof contentRaw.contentJson === "object" &&
    !Array.isArray(contentRaw.contentJson)
      ? (contentRaw.contentJson as Record<string, unknown>)
      : {};
  const existingEventsRaw = contentJsonRaw.diiaEvents;
  return Array.isArray(existingEventsRaw)
    ? (existingEventsRaw.filter(
        (x): x is DiiaEventLogItem => Boolean(x && typeof x === "object"),
      ) as DiiaEventLogItem[])
    : [];
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const forbidden = verifyWebhookSecret(req);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  const dealId = (url.searchParams.get("dealId") ?? "").trim();
  if (!sessionId && !dealId) {
    return NextResponse.json(
      { error: "Потрібно передати sessionId або dealId" },
      { status: 400 },
    );
  }

  const contract = await prisma.dealContract.findFirst({
    where: sessionId ? { diiaSessionId: sessionId } : { dealId },
    select: {
      id: true,
      dealId: true,
      status: true,
      diiaSessionId: true,
      updatedAt: true,
      content: true,
    },
  });
  if (!contract) {
    return NextResponse.json({ error: "Договір за sessionId не знайдено" }, { status: 404 });
  }

  const events = readDiiaEvents(contract.content).sort(
    (a, b) => +new Date(b.at) - +new Date(a.at),
  );
  return NextResponse.json({
    ok: true,
    contractId: contract.id,
    dealId: contract.dealId,
    sessionId: contract.diiaSessionId,
    status: contract.status,
    updatedAt: contract.updatedAt.toISOString(),
    eventsCount: events.length,
    lastEvent: events[0] ?? null,
    events,
  });
}

function resolveStatus(body: WebhookBody): DealContractStatus | null {
  const raw = (body.event ?? body.status ?? "").toString().trim().toLowerCase();
  if (!raw) return null;
  if (raw === "viewed" || raw === "viewed_by_client") return "VIEWED_BY_CLIENT";
  if (raw === "client_signed") return "CLIENT_SIGNED";
  if (raw === "company_signed") return "COMPANY_SIGNED";
  if (raw === "fully_signed" || raw === "completed") return "FULLY_SIGNED";
  if (raw === "declined" || raw === "rejected") return "DECLINED";
  if (raw === "expired") return "EXPIRED";
  return null;
}

function canTransition(from: DealContractStatus, to: DealContractStatus): boolean {
  if (from === to) return true;
  const matrix: Record<DealContractStatus, DealContractStatus[]> = {
    DRAFT: ["GENERATED", "EDITED", "SENT_FOR_SIGNATURE"],
    GENERATED: ["EDITED", "PENDING_INTERNAL_APPROVAL", "APPROVED_INTERNAL", "SENT_FOR_SIGNATURE"],
    EDITED: ["PENDING_INTERNAL_APPROVAL", "APPROVED_INTERNAL", "SENT_FOR_SIGNATURE", "GENERATED"],
    PENDING_INTERNAL_APPROVAL: ["APPROVED_INTERNAL", "EDITED", "DECLINED"],
    APPROVED_INTERNAL: ["SENT_FOR_SIGNATURE", "EDITED"],
    SENT_FOR_SIGNATURE: ["VIEWED_BY_CLIENT", "CLIENT_SIGNED", "DECLINED", "EXPIRED"],
    VIEWED_BY_CLIENT: ["CLIENT_SIGNED", "DECLINED", "EXPIRED"],
    CLIENT_SIGNED: ["COMPANY_SIGNED", "FULLY_SIGNED"],
    COMPANY_SIGNED: ["FULLY_SIGNED"],
    FULLY_SIGNED: ["SUPERSEDED"],
    DECLINED: ["DRAFT"],
    EXPIRED: ["DRAFT"],
    SUPERSEDED: [],
  };
  return matrix[from]?.includes(to) ?? false;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const forbidden = verifyWebhookSecret(req);
  if (forbidden) return forbidden;

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const sessionId = (body.sessionId ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "Потрібно передати sessionId" }, { status: 400 });
  }

  const nextStatus = resolveStatus(body);
  if (!nextStatus) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const contract = await prisma.dealContract.findFirst({
    where: { diiaSessionId: sessionId },
    select: { id: true, dealId: true, status: true, content: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "Договір за sessionId не знайдено" }, { status: 404 });
  }

  let finalStatus = nextStatus;
  if (
    (nextStatus === "COMPANY_SIGNED" && contract.status === "CLIENT_SIGNED") ||
    (nextStatus === "CLIENT_SIGNED" && contract.status === "COMPANY_SIGNED")
  ) {
    finalStatus = "FULLY_SIGNED";
  }

  if (!canTransition(contract.status, finalStatus)) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: `Перехід ${contract.status} -> ${finalStatus} заборонено`,
    });
  }

  const contentRaw =
    contract.content && typeof contract.content === "object" && !Array.isArray(contract.content)
      ? (contract.content as Record<string, unknown>)
      : {};
  const contentJsonRaw =
    contentRaw.contentJson &&
    typeof contentRaw.contentJson === "object" &&
    !Array.isArray(contentRaw.contentJson)
      ? (contentRaw.contentJson as Record<string, unknown>)
      : {};
  const existingEvents = readDiiaEvents(contract.content);
  const eventLog: DiiaEventLogItem = {
    at: new Date().toISOString(),
    incomingEvent: body.event ?? null,
    incomingStatus: body.status ?? null,
    resolvedStatus: finalStatus,
    providerEventId: body.providerEventId ?? null,
  };
  const nextEvents = [...existingEvents, eventLog].slice(-100);
  const nextContent = {
    ...contentRaw,
    contentJson: {
      ...contentJsonRaw,
      diiaEvents: nextEvents,
    },
  };

  await prisma.dealContract.update({
    where: { id: contract.id },
    data: { status: finalStatus, content: nextContent as unknown as object },
  });

  await appendActivityLog({
    entityType: "DEAL",
    entityId: contract.dealId,
    type: "CONTRACT_STATUS_CHANGED",
    actorUserId: null,
    source: "INTEGRATION",
    data: {
      status: nextStatus,
      finalStatus,
      action: "diia_webhook",
      sessionId,
      providerEventId: body.providerEventId ?? null,
    },
  });

  await persistReadinessSnapshot(contract.dealId, null);
  await dispatchDealAutomationTrigger({
    dealId: contract.dealId,
    trigger: "CONTRACT_STATUS_CHANGED",
    payload: { status: finalStatus, action: "diia_webhook", sessionId },
    startedById: null,
  });

  if (finalStatus === "FULLY_SIGNED") {
    const contactId = await markPrimaryContactCustomerOnContractFullySigned(contract.dealId);
    if (contactId) revalidatePath(`/contacts/${contactId}`);
    const dealForPlan = await prisma.deal.findUnique({
      where: { id: contract.dealId },
      select: { value: true, currency: true },
    });
    if (
      dealForPlan?.value != null &&
      Number(dealForPlan.value) > 0 &&
      !(await prisma.dealPaymentPlan.findUnique({
        where: { dealId: contract.dealId },
        select: { id: true },
      }))
    ) {
      await seedDealPaymentPlan7030(prisma, {
        dealId: contract.dealId,
        total: Number(dealForPlan.value),
        currency: dealForPlan.currency?.trim() || "UAH",
      });
    }
  }
  if (
    finalStatus === "FULLY_SIGNED" ||
    finalStatus === "DECLINED" ||
    finalStatus === "EXPIRED"
  ) {
    await closeDiiaSignatureStaleTasks({
      dealId: contract.dealId,
      resultComment: `Автозакрито webhook Дія: ${finalStatus}`,
    });
  }
  revalidatePath(`/deals/${contract.dealId}/workspace`);

  return NextResponse.json({ ok: true, status: finalStatus });
}
