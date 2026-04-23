import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { ProjectSpecApprovalStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeWorkspaceMeta } from "@/lib/deal-api/workspace-meta-merge";
import { appendActivityLog } from "@/lib/deal-api/audit";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

function normalizeStage(v: string | null | undefined): ProjectSpecApprovalStage {
  switch ((v ?? "").toLowerCase()) {
    case "client":
      return "CLIENT";
    case "technical":
      return "TECHNICAL";
    case "execution":
      return "EXECUTION";
    default:
      return "COMMERCIAL";
  }
}

async function ensureProjectSpecByDeal(dealId: string) {
  const order = await prisma.order.findFirst({
    where: { dealId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!order) return null;

  const spec = await prisma.projectSpec.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      dealId,
      status: "DRAFT",
    },
    update: {
      dealId,
    },
  });
  return spec;
}

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_VIEW, deal);
  if (denied) return denied;

  const spec = await ensureProjectSpecByDeal(dealId);
  if (!spec) {
    return NextResponse.json(
      { error: "Для замовлення ще не створено Order." },
      { status: 409 },
    );
  }

  const full = await prisma.projectSpec.findUnique({
    where: { id: spec.id },
    include: {
      currentVersion: true,
      versions: {
        orderBy: { versionNo: "desc" },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    projectSpec: full,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { dealId } = await ctx.params;

  let body: {
    action?: string;
    versionId?: string;
    changeReason?: string;
    notes?: string;
    requiredFilesComplete?: boolean;
    approvalStage?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true, workspaceMeta: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.DEALS_UPDATE, deal);
  if (denied) return denied;

  const spec = await ensureProjectSpecByDeal(dealId);
  if (!spec) {
    return NextResponse.json(
      { error: "Для замовлення ще не створено Order." },
      { status: 409 },
    );
  }

  const action = (body.action ?? "").trim().toLowerCase();
  if (!action) {
    return NextResponse.json({ error: "Потрібен action." }, { status: 400 });
  }

  if (action === "create_version") {
    const latest = await prisma.projectSpecVersion.findFirst({
      where: { projectSpecId: spec.id },
      orderBy: { versionNo: "desc" },
      select: { versionNo: true },
    });
    const nextVersionNo = (latest?.versionNo ?? 0) + 1;
    const created = await prisma.projectSpecVersion.create({
      data: {
        projectSpecId: spec.id,
        versionNo: nextVersionNo,
        approvalStage: normalizeStage(body.approvalStage),
        status: "DRAFT",
        changeReason: body.changeReason?.trim() || null,
        notes: body.notes?.trim() || null,
        createdById: user.id,
      },
      select: { id: true, versionNo: true },
    });
    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_UPDATED",
      actorUserId: user.id,
      data: { projectSpecVersionCreated: created.id, versionNo: created.versionNo },
    });
    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true, created });
  }

  if (!body.versionId || !body.versionId.trim()) {
    return NextResponse.json(
      { error: "Для цієї дії потрібен versionId." },
      { status: 400 },
    );
  }

  const version = await prisma.projectSpecVersion.findFirst({
    where: { id: body.versionId.trim(), projectSpecId: spec.id },
    select: { id: true, versionNo: true },
  });
  if (!version) {
    return NextResponse.json({ error: "Версію не знайдено." }, { status: 404 });
  }

  if (action === "set_current_version") {
    await prisma.projectSpec.update({
      where: { id: spec.id },
      data: {
        currentVersionId: version.id,
        status: "UNDER_REVIEW",
      },
    });
    const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, {
      projectSpec: {
        currentVersionId: version.id,
        currentVersionNo: version.versionNo,
        approvalStage: "technical",
        currentVersionApprovedForExecution: false,
      },
    });
    await prisma.deal.update({
      where: { id: dealId },
      data: { workspaceMeta: nextMeta },
    });
    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true, currentVersionId: version.id });
  }

  if (action === "approve_execution") {
    await prisma.$transaction([
      prisma.projectSpecVersion.updateMany({
        where: {
          projectSpecId: spec.id,
          id: { not: version.id },
          isExecutionBaseline: true,
        },
        data: { isExecutionBaseline: false },
      }),
      prisma.projectSpecVersion.update({
        where: { id: version.id },
        data: {
          status: "APPROVED",
          approvalStage: "EXECUTION",
          approvedAt: new Date(),
          approvedByUserId: user.id,
          isExecutionBaseline: true,
        },
      }),
      prisma.projectSpec.update({
        where: { id: spec.id },
        data: {
          currentVersionId: version.id,
          status: "APPROVED_FOR_EXECUTION",
        },
      }),
    ]);

    const requiredFilesComplete = body.requiredFilesComplete === true;
    const nextMeta = mergeWorkspaceMeta(deal.workspaceMeta, {
      projectSpec: {
        currentVersionId: version.id,
        currentVersionNo: version.versionNo,
        approvalStage: "execution",
        currentVersionApprovedForExecution: true,
        requiredFilesComplete,
        approvedAt: new Date().toISOString(),
      },
    });
    await prisma.deal.update({
      where: { id: dealId },
      data: { workspaceMeta: nextMeta },
    });
    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "DEAL_UPDATED",
      actorUserId: user.id,
      data: {
        projectSpecApprovedForExecution: true,
        versionId: version.id,
      },
    });
    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true, approvedVersionId: version.id });
  }

  return NextResponse.json({ error: "Невідома дія." }, { status: 400 });
}
