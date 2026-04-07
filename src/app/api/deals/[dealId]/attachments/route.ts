import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { AttachmentCategory } from "@prisma/client";
import { isAttachmentUploadCategory } from "../../../../../lib/attachments/upload-categories";
import { prisma } from "../../../../../lib/prisma";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import { persistReadinessSnapshot } from "../../../../../lib/deal-api/persist-readiness";
import { dispatchDealAutomationTrigger } from "../../../../../lib/automation/dispatch";
import { scheduleFileAiProcessing } from "../../../../../features/ai/file-intelligence/process-file-extraction";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";

type Ctx = { params: Promise<{ dealId: string }> };

function isCategory(v: string): v is AttachmentCategory {
  return isAttachmentUploadCategory(v);
}

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  let body: {
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    category?: string;
    fileAssetId?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const fileName =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType.trim()
      ? body.mimeType.trim()
      : "application/octet-stream";

  if (!fileName || !fileUrl) {
    return NextResponse.json(
      { error: "Потрібні fileName та fileUrl" },
      { status: 400 },
    );
  }

  if (!body.category || !isCategory(body.category)) {
    return NextResponse.json({ error: "Некоректна категорія" }, { status: 400 });
  }

  const category = body.category;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.FILES_UPLOAD, deal);
    if (denied) return denied;

    const userId = user.id;

    const existingAssetId =
      typeof body.fileAssetId === "string" && body.fileAssetId.trim()
        ? body.fileAssetId.trim()
        : null;

    const att = await prisma.$transaction(async (tx) => {
      let fileAssetId: string;
      let version = 1;

      if (existingAssetId) {
        const fa = await tx.fileAsset.findFirst({
          where: { id: existingAssetId, dealId },
        });
        if (!fa) {
          throw new Error("FILE_ASSET_NOT_FOUND");
        }
        if (fa.category !== category) {
          throw new Error("FILE_ASSET_CATEGORY_MISMATCH");
        }
        fileAssetId = fa.id;
        const last = await tx.attachment.findFirst({
          where: { fileAssetId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        version = (last?.version ?? 0) + 1;
        await tx.attachment.updateMany({
          where: { fileAssetId },
          data: { isCurrentVersion: false },
        });
      } else {
        const fa = await tx.fileAsset.create({
          data: {
            dealId,
            category,
            displayName: fileName,
          },
        });
        fileAssetId = fa.id;
      }

      return tx.attachment.create({
        data: {
          fileName,
          fileUrl,
          mimeType,
          category,
          entityType: "DEAL",
          entityId: dealId,
          uploadedById: userId,
          fileAssetId,
          version,
          isCurrentVersion: true,
        },
      });
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "FILE_UPLOADED",
      actorUserId: userId,
      data: {
        attachmentId: att.id,
        category,
        fileName,
        fileAssetId: att.fileAssetId,
        version: att.version,
      },
    });

    await persistReadinessSnapshot(dealId, userId);
    await dispatchDealAutomationTrigger({
      dealId,
      trigger: "FILE_UPLOADED",
      payload: { attachmentId: att.id, category },
      startedById: userId,
    });

    revalidatePath(`/deals/${dealId}/workspace`);

    const full = await prisma.attachment.findUnique({
      where: { id: att.id },
      select: { id: true, storageKey: true },
    });
    if (full?.storageKey?.trim()) {
      scheduleFileAiProcessing(full.id, userId);
    }

    return NextResponse.json({
      ok: true,
      id: att.id,
      fileAssetId: att.fileAssetId,
      version: att.version,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "FILE_ASSET_NOT_FOUND") {
      return NextResponse.json(
        { error: "Логічний файл не знайдено для цієї угоди" },
        { status: 400 },
      );
    }
    if (e instanceof Error && e.message === "FILE_ASSET_CATEGORY_MISMATCH") {
      return NextResponse.json(
        { error: "Категорія має збігатися з логічним файлом" },
        { status: 400 },
      );
    }
     
    console.error("[POST deal attachment]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
