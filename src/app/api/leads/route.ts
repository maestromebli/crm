import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { AttachmentCategory } from "@prisma/client";
import { isAttachmentUploadCategory } from "@/lib/attachments/upload-categories";
import { appendActivityLog } from "@/lib/deal-api/audit";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  canAccessOwner,
  resolveAccessContext,
} from "@/lib/authz/data-scope";
import { isLeadAssignableManagerRole } from "@/lib/leads/lead-owner-roles";
import { resolveDefaultLeadStage } from "@/lib/leads/resolve-default-stage";
import { ensureContactForLead } from "@/lib/leads/ensure-contact-from-lead";
import { prisma } from "@/lib/prisma";
import { requireDatabaseUrl } from "@/lib/api/route-guards";
import { saveLeadUploadPrivate } from "@/lib/uploads/lead-disk-upload";

const PRIORITIES = new Set(["low", "normal", "high"]);

export async function POST(req: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.LEADS_CREATE);
  if (denied) return denied;

  const sessionUserId = user.id;

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let body: {
    title?: string;
    contactName?: string;
    phone?: string;
    email?: string | null;
    source?: string;
    note?: string | null;
    priority?: string;
    ownerId?: string | null;
  };
  let uploadFiles: File[] = [];
  let multipartFileCategory: AttachmentCategory = "OTHER";

  if (isMultipart) {
    let fd: FormData;
    try {
      fd = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Некоректний multipart" },
        { status: 400 },
      );
    }
    const str = (key: string) => {
      const v = fd.get(key);
      return typeof v === "string" ? v.trim() : "";
    };
    body = {
      title: str("title") || undefined,
      contactName: str("contactName") || undefined,
      phone: str("phone") || undefined,
      email: str("email") || null,
      source: str("source") || undefined,
      note: str("note") || null,
      priority: str("priority") || undefined,
      ownerId: str("ownerId") || undefined,
    };
    uploadFiles = fd
      .getAll("files")
      .filter((x): x is File => x instanceof File);
    const cat = str("fileCategory");
    if (cat && isAttachmentUploadCategory(cat)) {
      multipartFileCategory = cat;
    }
  } else {
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
    }
  }

  const contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!contactName && !phone) {
    return NextResponse.json(
      { error: "Вкажіть імʼя або телефон" },
      { status: 400 },
    );
  }

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : "Вручну";
  const email =
    body.email === null || body.email === undefined
      ? null
      : String(body.email).trim() || null;
  const note =
    body.note === null || body.note === undefined
      ? null
      : String(body.note).trim() || null;
  const priority =
    typeof body.priority === "string" && PRIORITIES.has(body.priority)
      ? body.priority
      : "normal";

  let title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "";
  if (!title) {
    title = contactName || phone || "Новий лід";
  }

  let ownerId = sessionUserId;
  const requestedOwner =
    typeof body.ownerId === "string" ? body.ownerId.trim() : "";
  if (requestedOwner && requestedOwner !== sessionUserId) {
    const assignDenied = forbidUnlessPermission(user, P.LEADS_ASSIGN);
    if (assignDenied) return assignDenied;

    const ctx = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });

    const assignee = await prisma.user.findUnique({
      where: { id: requestedOwner },
      select: { id: true, role: true },
    });
    if (!assignee) {
      return NextResponse.json(
        { error: "Відповідального не знайдено" },
        { status: 400 },
      );
    }
    if (!isLeadAssignableManagerRole(assignee.role)) {
      return NextResponse.json(
        { error: "Відповідальним можна призначити лише менеджера" },
        { status: 400 },
      );
    }
    if (!canAccessOwner(ctx, requestedOwner)) {
      return NextResponse.json(
        { error: "Недостатньо прав призначити цього менеджера" },
        { status: 403 },
      );
    }
    ownerId = requestedOwner;
  }

  if (uploadFiles.length > 0) {
    const filesDenied = forbidUnlessPermission(user, P.FILES_UPLOAD);
    if (filesDenied) return filesDenied;
  }

  try {
    const stage = await resolveDefaultLeadStage();
    if (!stage) {
      return NextResponse.json(
        {
          error:
            "Немає воронки для лідів. Виконайте `pnpm db:seed` або створіть Pipeline з entityType LEAD.",
        },
        { status: 409 },
      );
    }

    const lead = await prisma.lead.create({
      data: {
        title,
        source,
        pipelineId: stage.pipelineId,
        stageId: stage.stageId,
        priority,
        contactName: contactName || null,
        phone: phone || null,
        email,
        note,
        ownerId,
      },
    });

    await ensureContactForLead(prisma, lead.id);

    await appendActivityLog({
      entityType: "LEAD",
      entityId: lead.id,
      type: "LEAD_CREATED",
      actorUserId: sessionUserId,
      data: {
        title: lead.title,
        source: lead.source,
        ownerId: lead.ownerId,
        assignedByUserId:
          ownerId !== sessionUserId ? sessionUserId : undefined,
      },
    });

    revalidatePath("/leads");
    revalidatePath("/leads/new");
    revalidatePath("/leads/no-response");
    revalidatePath("/leads/no-next-step");
    revalidatePath("/leads/mine");
    revalidatePath("/leads/overdue");
    revalidatePath("/leads/duplicates");
    revalidatePath("/leads/re-contact");
    revalidatePath("/leads/converted");
    revalidatePath("/leads/unassigned");
    revalidatePath("/leads/qualified");
    revalidatePath("/leads/lost");
    revalidatePath("/leads/pipeline");

    const uploadErrors: string[] = [];
    for (const file of uploadFiles) {
      try {
        const attachmentId = randomUUID();
        const saved = await saveLeadUploadPrivate({
          leadId: lead.id,
          attachmentId,
          file,
        });
        await prisma.attachment.create({
          data: {
            id: attachmentId,
            fileName: saved.originalName,
            fileUrl: saved.fileUrl,
            storageKey: saved.storageKey,
            mimeType: saved.mimeType,
            fileSize: saved.bytes,
            category: multipartFileCategory,
            entityType: "LEAD",
            entityId: lead.id,
            uploadedById: sessionUserId,
            version: 1,
            isCurrentVersion: true,
            fileAssetId: null,
          },
        });
        await appendActivityLog({
          entityType: "LEAD",
          entityId: lead.id,
          type: "FILE_UPLOADED",
          actorUserId: sessionUserId,
          data: {
            fileName: saved.originalName,
            category: multipartFileCategory,
          },
        });
      } catch (e) {
        let hint = "не вдалося зберегти";
        if (e instanceof Error) {
          if (e.message === "FILE_TOO_LARGE") hint = "завеликий (макс. 20 МБ)";
          else if (e.message === "MIME_NOT_ALLOWED") hint = "тип файлу заборонено";
          else if (e.message === "EMPTY_FILE") hint = "порожній файл";
        }
        uploadErrors.push(`${file.name}: ${hint}`);
      }
    }

    if (uploadFiles.length > 0) {
      revalidatePath(`/leads/${lead.id}`);
      revalidatePath(`/leads/${lead.id}/files`);
    }

    return NextResponse.json({
      ok: true,
      id: lead.id,
      ...(uploadErrors.length ? { uploadErrors } : {}),
    });
  } catch (e) {
     
    console.error("[POST leads]", e);
    return NextResponse.json({ error: "Помилка збереження ліда" }, { status: 500 });
  }
}
