import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { mapContractDetails, ensureContractUpdateAllowed, extractContentParts } from "@/lib/contracts/service";
import { patchContractSchema } from "@/lib/contracts/schemas";
import { apiToDealContractStatus } from "@/lib/contracts/status-map";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_VIEW);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "Контракт не знайдено" }, { status: 404 });
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      entityType: "DEAL",
      entityId: contract.dealId,
      deletedAt: null,
      category: { in: ["CONTRACT", "SPEC"] },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      category: true,
      createdAt: true,
    },
  });

  const timeline = await prisma.activityLog.findMany({
    where: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: { in: ["CONTRACT_STATUS_CHANGED", "CONTRACT_CREATED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      actorUserId: true,
      source: true,
      data: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: {
      ...mapContractDetails(contract),
      documents: attachments.map((item) => ({
        id: item.id,
        fileName: item.fileName,
        fileUrl: item.fileUrl,
        type: item.category,
        createdAt: item.createdAt.toISOString(),
      })),
      audit: timeline.map((row) => ({
        id: row.id,
        action: row.type,
        actorUserId: row.actorUserId,
        source: row.source,
        payload: row.data,
        createdAt: row.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await ctx.params;
  const contract = await prisma.dealContract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "Контракт не знайдено" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }
  const parsed = patchContractSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні дані", details: parsed.error.flatten() }, { status: 400 });
  }

  const { fields: currentFields, contentJson } = extractContentParts(contract.content);
  try {
    ensureContractUpdateAllowed({
      currentStatus: contract.status,
      targetStatus: parsed.data.status,
      updates: parsed.data.fields,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "UPDATE_NOT_ALLOWED";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const nextFields = {
    ...currentFields,
    ...(parsed.data.fields ?? {}),
  };

  const nextStatus = parsed.data.status ? apiToDealContractStatus(parsed.data.status) : contract.status;
  const nextContent = {
    ...(typeof contract.content === "object" && contract.content ? (contract.content as Record<string, unknown>) : {}),
    contentJson: {
      ...contentJson,
      fields: nextFields,
    },
  } as object;

  const updated = await prisma.dealContract.update({
    where: { id },
    data: {
      status: nextStatus,
      content: nextContent,
    },
  });

  await prisma.activityLog.create({
    data: {
      entityType: "DEAL",
      entityId: contract.dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: user.id,
      source: "USER",
      data: {
        action: "contracts_patch",
        status: nextStatus,
        fields: Object.keys(parsed.data.fields ?? {}),
      },
    },
  });

  return NextResponse.json({ ok: true, data: mapContractDetails(updated) });
}
