import { NextResponse } from "next/server";
import { z } from "zod";
import type { AiDetectedFileCategory } from "@prisma/client";
import { prisma } from "../../../../../lib/prisma";
import { forbidUnlessAttachmentReadAccess } from "../../../../../lib/attachments/attachment-download-access";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import { requireDatabaseUrl } from "../../../../../lib/api/route-guards";
import { scheduleFileAiProcessing } from "../../../../../features/ai/file-intelligence/process-file-extraction";
import { requireAiRateLimit } from "../../../../../lib/ai/route-guard";
import { logAiEvent } from "../../../../../lib/ai/log-ai-event";

export const runtime = "nodejs";

const patchSchema = z.object({
  userConfirmedCategory: z.enum([
    "PROJECT",
    "PHOTO",
    "DIMENSIONS",
    "MEASUREMENT",
    "COMMERCIAL_PROPOSAL",
    "CONTRACT",
    "INVOICE",
    "TECHNICAL",
    "VISUALIZATION",
    "MESSENGER_SCREENSHOT",
    "OTHER",
  ]),
});

type Ctx = { params: Promise<{ attachmentId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const perm = forbidUnlessPermission(user, P.FILES_VIEW);
  if (perm) return perm;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_file_extraction_get",
    maxRequests: 60,
    windowMinutes: 10,
  });
  if (limited) return limited;

  const { attachmentId } = await ctx.params;
  if (!attachmentId?.trim()) {
    return NextResponse.json({ error: "Некоректний id" }, { status: 400 });
  }

  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId.trim(), deletedAt: null },
    select: { id: true, entityType: true, entityId: true },
  });
  if (!att) {
    return NextResponse.json({ error: "Файл не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessAttachmentReadAccess(user, att);
  if (denied) return denied;

  const row = await prisma.fileAiExtraction.findUnique({
    where: { attachmentId: att.id },
  });

  if (!row) {
    return NextResponse.json({ error: "Аналіз ще не створено" }, { status: 404 });
  }

  return NextResponse.json(row);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const perm = forbidUnlessPermission(user, P.FILES_UPLOAD);
  if (perm) return perm;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_file_extraction_patch",
    maxRequests: 30,
    windowMinutes: 10,
  });
  if (limited) return limited;

  const { attachmentId } = await ctx.params;
  if (!attachmentId?.trim()) {
    return NextResponse.json({ error: "Некоректний id" }, { status: 400 });
  }

  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId.trim(), deletedAt: null },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      mimeType: true,
      fileName: true,
    },
  });
  if (!att) {
    return NextResponse.json({ error: "Файл не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessAttachmentReadAccess(user, att);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Некоректні дані", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cat = parsed.data.userConfirmedCategory as AiDetectedFileCategory;

  await prisma.fileAiExtraction.upsert({
    where: { attachmentId: att.id },
    create: {
      attachmentId: att.id,
      entityType: att.entityType,
      entityId: att.entityId,
      mimeType: att.mimeType,
      originalFilename: att.fileName,
      userConfirmedCategory: cat,
      processingStatus: "PENDING",
    },
    update: { userConfirmedCategory: cat },
  });
  await logAiEvent({
    userId: user.id,
    action: "ai_file_extraction_patch",
    model: null,
    ok: true,
    entityType: att.entityType,
    entityId: att.entityId,
    metadata: { attachmentId: att.id, userConfirmedCategory: cat },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(_req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const perm = forbidUnlessPermission(user, P.FILES_UPLOAD);
  if (perm) return perm;
  const limited = await requireAiRateLimit({
    userId: user.id,
    action: "ai_file_extraction_queue",
    maxRequests: 20,
    windowMinutes: 10,
  });
  if (limited) return limited;

  const { attachmentId } = await ctx.params;
  if (!attachmentId?.trim()) {
    return NextResponse.json({ error: "Некоректний id" }, { status: 400 });
  }

  const att = await prisma.attachment.findFirst({
    where: { id: attachmentId.trim(), deletedAt: null },
    select: { id: true, entityType: true, entityId: true },
  });
  if (!att) {
    return NextResponse.json({ error: "Файл не знайдено" }, { status: 404 });
  }

  const denied = await forbidUnlessAttachmentReadAccess(user, att);
  if (denied) return denied;

  scheduleFileAiProcessing(att.id, user.id);
  await logAiEvent({
    userId: user.id,
    action: "ai_file_extraction_queue",
    model: null,
    ok: true,
    entityType: att.entityType,
    entityId: att.entityId,
    metadata: { attachmentId: att.id, queued: true },
  });
  return NextResponse.json({ ok: true, queued: true });
}
