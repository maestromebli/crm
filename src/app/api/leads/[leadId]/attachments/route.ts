import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { AttachmentCategory } from "@prisma/client";
import { isAttachmentUploadCategory } from "../../../../../lib/attachments/upload-categories";
import { appendActivityLog } from "../../../../../lib/deal-api/audit";
import {
  forbidUnlessLeadAccess,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { prisma } from "../../../../../lib/prisma";
import { saveLeadUploadPrivate } from "../../../../../lib/uploads/lead-disk-upload";
import { scheduleFileAiProcessing } from "../../../../../features/ai/file-intelligence/process-file-extraction";

type Ctx = { params: Promise<{ leadId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId } = await ctx.params;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Очікується multipart/form-data" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Додайте файл (поле file)" }, {
      status: 400,
    });
  }

  const rawCategory = formData.get("category");
  const categoryRaw =
    typeof rawCategory === "string" ? rawCategory.trim() : "";
  const category: AttachmentCategory =
    categoryRaw && isAttachmentUploadCategory(categoryRaw)
      ? categoryRaw
      : "OTHER";

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessLeadAccess(user, P.FILES_UPLOAD, lead);
    if (denied) return denied;

    const attachmentId = randomUUID();
    let saved;
    try {
      saved = await saveLeadUploadPrivate({ leadId, attachmentId, file });
    } catch (e) {
      if (e instanceof Error) {
        if (e.message === "FILE_TOO_LARGE") {
          return NextResponse.json(
            { error: "Файл завеликий (макс. 20 МБ)" },
            { status: 413 },
          );
        }
        if (e.message === "MIME_NOT_ALLOWED") {
          return NextResponse.json(
            {
              error:
                "Тип файлу не дозволено. Дозволені: зображення, PDF, Office, txt, zip",
            },
            { status: 400 },
          );
        }
        if (e.message === "EMPTY_FILE") {
          return NextResponse.json({ error: "Порожній файл" }, {
            status: 400,
          });
        }
      }
      throw e;
    }

    const att = await prisma.attachment.create({
      data: {
        id: attachmentId,
        fileName: saved.originalName,
        fileUrl: saved.fileUrl,
        storageKey: saved.storageKey,
        mimeType: saved.mimeType,
        fileSize: saved.bytes,
        category,
        entityType: "LEAD",
        entityId: leadId,
        uploadedById: user.id,
        version: 1,
        isCurrentVersion: true,
        fileAssetId: null,
      },
    });

    await prisma.fileAiExtraction
      .create({
        data: {
          attachmentId: att.id,
          entityType: "LEAD",
          entityId: leadId,
          mimeType: att.mimeType,
          originalFilename: att.fileName,
          processingStatus: "PENDING",
        },
      })
      .catch(() => {
        /* race with async pipeline */
      });

    await appendActivityLog({
      entityType: "LEAD",
      entityId: leadId,
      type: "FILE_UPLOADED",
      actorUserId: user.id,
      data: {
        attachmentId: att.id,
        category,
        fileName: saved.originalName,
      },
    });

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/files`);

    scheduleFileAiProcessing(att.id, user.id);

    return NextResponse.json({
      ok: true,
      id: att.id,
      fileUrl: att.fileUrl,
      fileName: att.fileName,
    });
  } catch (e) {
     
    console.error("[POST leads/[leadId]/attachments]", e);
    return NextResponse.json({ error: "Помилка збереження файлу" }, {
      status: 500,
    });
  }
}
