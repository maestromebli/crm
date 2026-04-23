import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type {
  AttachmentCategory,
  ContactCategory,
  ClientType,
  Prisma,
} from "@prisma/client";
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
import { CORE_EVENT_TYPES, publishEntityEvent } from "@/lib/events/crm-events";
import { recordWorkflowEvent, WORKFLOW_EVENT_TYPES } from "@/features/event-system";

const PRIORITIES = new Set(["low", "normal", "high"]);
const CONTACT_CATEGORIES = new Set<ContactCategory>([
  "DESIGNER",
  "CONSTRUCTION_COMPANY",
  "MANAGER",
  "DESIGN_STUDIO",
  "END_CUSTOMER",
  "ARCHITECT",
  "SUPPLIER",
  "OTHER",
]);
const REFERRAL_TYPES = new Set(["DESIGNER", "CONSTRUCTION_COMPANY", "PERSON"]);

function logLeadCreateSideEffectError(step: string, error: unknown) {
  console.error(`[POST leads] non-fatal side-effect failed: ${step}`, error);
}

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
    orderNumber?: string | null;
    email?: string | null;
    source?: string;
    note?: string | null;
    priority?: string;
    ownerId?: string | null;
    designerUserId?: string | null;
    customerType?: ClientType | null;
    companyName?: string | null;
    companyContacts?:
      | Array<{
          fullName?: string | null;
          phone?: string | null;
          email?: string | null;
          category?: string | null;
        }>
      | null;
    companyContactsJson?: string | null;
    referralType?: string | null;
    referralName?: string | null;
    referralPhone?: string | null;
    referralEmail?: string | null;
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
      orderNumber: str("orderNumber") || null,
      email: str("email") || null,
      source: str("source") || undefined,
      note: str("note") || null,
      priority: str("priority") || undefined,
      ownerId: str("ownerId") || undefined,
      designerUserId: str("designerUserId") || undefined,
      customerType: (str("customerType") as ClientType) || null,
      companyName: str("companyName") || null,
      companyContactsJson: str("companyContactsJson") || null,
      referralType: str("referralType") || null,
      referralName: str("referralName") || null,
      referralPhone: str("referralPhone") || null,
      referralEmail: str("referralEmail") || null,
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

  if (
    !body.companyContacts &&
    typeof body.companyContactsJson === "string" &&
    body.companyContactsJson.trim()
  ) {
    try {
      const parsedContacts = JSON.parse(body.companyContactsJson) as unknown;
      if (Array.isArray(parsedContacts)) {
        body.companyContacts = parsedContacts as Array<{
          fullName?: string | null;
          phone?: string | null;
          email?: string | null;
          category?: string | null;
        }>;
      }
    } catch {
      return NextResponse.json(
        { error: "Некоректний формат companyContacts" },
        { status: 400 },
      );
    }
  }

  const contactName =
    typeof body.contactName === "string" ? body.contactName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const orderNumberRaw =
    body.orderNumber === null || body.orderNumber === undefined
      ? ""
      : String(body.orderNumber).trim().toUpperCase();
  const orderNumberMatch = /^(?:ЕМ|EM)-([1-9]\d{0,2})$/u.exec(orderNumberRaw);
  if (!orderNumberMatch) {
    return NextResponse.json(
      { error: "Номер замовлення має бути у форматі ЕМ-1 ... ЕМ-200" },
      { status: 400 },
    );
  }
  const orderNumberValue = Number(orderNumberMatch[1]);
  if (!Number.isFinite(orderNumberValue) || orderNumberValue < 1 || orderNumberValue > 200) {
    return NextResponse.json(
      { error: "Номер замовлення має бути у діапазоні ЕМ-1 ... ЕМ-200" },
      { status: 400 },
    );
  }
  const orderNumber = `ЕМ-${orderNumberValue}`;

  const source =
    typeof body.source === "string" && body.source.trim()
      ? body.source.trim()
      : "Вручну";
  const designerUserIdRaw =
    typeof body.designerUserId === "string" ? body.designerUserId.trim() : "";
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
  const customerTypeRaw =
    typeof body.customerType === "string" ? body.customerType.trim() : "";
  const customerType: ClientType =
    customerTypeRaw === "COMPANY" ? "COMPANY" : "PERSON";
  const companyNameRaw =
    body.companyName === null || body.companyName === undefined
      ? ""
      : String(body.companyName).trim();
  const referralTypeRaw =
    body.referralType === null || body.referralType === undefined
      ? ""
      : String(body.referralType).trim().toUpperCase();
  const referralType = REFERRAL_TYPES.has(referralTypeRaw)
    ? referralTypeRaw
    : "PERSON";
  const referralName =
    body.referralName === null || body.referralName === undefined
      ? null
      : String(body.referralName).trim() || null;
  const referralPhone =
    body.referralPhone === null || body.referralPhone === undefined
      ? null
      : String(body.referralPhone).trim() || null;
  const referralEmail =
    body.referralEmail === null || body.referralEmail === undefined
      ? null
      : String(body.referralEmail).trim() || null;
  const companyContactsInput = Array.isArray(body.companyContacts)
    ? body.companyContacts
    : [];
  const companyContacts = companyContactsInput
    .map((item) => {
      const fullName =
        item?.fullName === null || item?.fullName === undefined
          ? ""
          : String(item.fullName).trim();
      const phoneValue =
        item?.phone === null || item?.phone === undefined
          ? null
          : String(item.phone).trim() || null;
      const emailValue =
        item?.email === null || item?.email === undefined
          ? null
          : String(item.email).trim() || null;
      const categoryRaw =
        item?.category === null || item?.category === undefined
          ? ""
          : String(item.category).trim().toUpperCase();
      const category = CONTACT_CATEGORIES.has(categoryRaw as ContactCategory)
        ? (categoryRaw as ContactCategory)
        : "OTHER";
      return { fullName, phone: phoneValue, email: emailValue, category };
    })
    .filter((item) => item.fullName || item.phone || item.email);
  if (customerType === "COMPANY" && !companyNameRaw) {
    return NextResponse.json(
      { error: "Для компанії вкажіть назву" },
      { status: 400 },
    );
  }
  if (customerType === "COMPANY" && companyContacts.length === 0) {
    return NextResponse.json(
      { error: "Додайте хоча б одну контактну особу компанії" },
      { status: 400 },
    );
  }
  if (
    !contactName &&
    !phone &&
    !(customerType === "COMPANY" && companyContacts.length > 0)
  ) {
    return NextResponse.json(
      { error: "Вкажіть імʼя або телефон" },
      { status: 400 },
    );
  }

  let title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "";
  if (!title) {
    title =
      (customerType === "COMPANY" ? companyNameRaw : "") ||
      contactName ||
      phone ||
      "Новий лід";
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

  let sourceDesigner:
    | {
        id: string;
        name: string | null;
        email: string;
      }
    | null = null;
  const normalizedSource = source.toLowerCase();
  const isDesignerSource =
    normalizedSource.includes("дизайнер") || normalizedSource.includes("designer");
  const isReferralSource =
    normalizedSource.includes("рекомендац") ||
    normalizedSource.includes("referral") ||
    isDesignerSource;
  if (isDesignerSource) {
    if (!designerUserIdRaw && !referralName) {
      return NextResponse.json(
        {
          error:
            "Для джерела «Дизайнер» потрібно обрати дизайнера або вказати його вручну",
        },
        { status: 400 },
      );
    }
    if (designerUserIdRaw) {
      const ctx = await resolveAccessContext(prisma, {
        id: user.id,
        role: user.dbRole,
      });
      if (!canAccessOwner(ctx, designerUserIdRaw)) {
        return NextResponse.json(
          { error: "Недостатньо прав обрати цього дизайнера" },
          { status: 403 },
        );
      }
      const designer = await prisma.user.findUnique({
        where: { id: designerUserIdRaw },
        select: { id: true, name: true, email: true },
      });
      if (!designer) {
        return NextResponse.json(
          { error: "Дизайнера не знайдено" },
          { status: 400 },
        );
      }
      sourceDesigner = designer;
    }
  }
  if (isReferralSource && !sourceDesigner && !referralName) {
    return NextResponse.json(
      { error: "Вкажіть, хто привів замовника" },
      { status: 400 },
    );
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

    const lead = await prisma.$transaction(async (tx) => {
      let companyClientId: string | null = null;
      let primaryContactId: string | null = null;
      let effectiveContactName = contactName || null;
      let effectivePhone = phone || null;
      let effectiveEmail = email;
      const linkedContacts: Array<{
        id: string;
        role: string | null;
        isPrimary: boolean;
      }> = [];

      if (customerType === "COMPANY") {
        const client = await tx.client.create({
          data: {
            name: companyNameRaw,
            type: "COMPANY",
          },
          select: { id: true },
        });
        companyClientId = client.id;
        const firstCompanyContact = companyContacts[0] ?? null;

        const primaryContact = await tx.contact.create({
          data: {
            fullName:
              contactName ||
              firstCompanyContact?.fullName ||
              companyNameRaw ||
              "Контакт компанії",
            phone: phone || firstCompanyContact?.phone || null,
            email: email || firstCompanyContact?.email || null,
            category: "END_CUSTOMER",
            clientId: companyClientId,
          },
          select: { id: true, fullName: true, phone: true, email: true },
        });

        primaryContactId = primaryContact.id;
        effectiveContactName = primaryContact.fullName;
        effectivePhone = primaryContact.phone;
        effectiveEmail = primaryContact.email;
        linkedContacts.push({
          id: primaryContact.id,
          role: "Основний контакт",
          isPrimary: true,
        });

        for (const extra of companyContacts) {
          const isSameAsPrimary =
            extra.fullName.trim() === (primaryContact.fullName ?? "").trim() &&
            (extra.phone ?? "") === (primaryContact.phone ?? "") &&
            (extra.email ?? "") === (primaryContact.email ?? "");
          if (isSameAsPrimary) continue;
          const created = await tx.contact.create({
            data: {
              fullName: extra.fullName || "Контакт компанії",
              phone: extra.phone,
              email: extra.email,
              category: extra.category,
              clientId: companyClientId,
            },
            select: { id: true },
          });
          linkedContacts.push({
            id: created.id,
            role: "Контакт компанії",
            isPrimary: false,
          });
        }
      }

      const hubMeta: Record<string, unknown> = {};
      if (sourceDesigner) {
        hubMeta.sourceDesigner = {
          userId: sourceDesigner.id,
          name: sourceDesigner.name,
          email: sourceDesigner.email,
        };
      }
      if (isReferralSource && (referralName || sourceDesigner)) {
        hubMeta.referral = {
          type: sourceDesigner ? "DESIGNER" : referralType,
          name:
            sourceDesigner?.name?.trim() ||
            referralName ||
            sourceDesigner?.email ||
            null,
          phone: referralPhone,
          email: referralEmail ?? sourceDesigner?.email ?? null,
        };
      }
      if (customerType === "COMPANY") {
        hubMeta.customer = {
          type: "COMPANY",
          name: companyNameRaw,
          contactsCount: companyContacts.length,
        };
      }
      hubMeta.orderNumber = orderNumber;

      const leadCreateData: Prisma.LeadUncheckedCreateInput = {
        title,
        source,
        pipelineId: stage.pipelineId,
        stageId: stage.stageId,
        priority,
        contactName: effectiveContactName,
        phone: effectivePhone,
        email: effectiveEmail,
        note,
        ownerId,
        clientId: companyClientId,
        contactId: primaryContactId,
        ...(Object.keys(hubMeta).length
          ? { hubMeta: hubMeta as Prisma.InputJsonValue }
          : {}),
      };

      const createdLead = await tx.lead.create({
        data: leadCreateData,
      });

      for (const linked of linkedContacts) {
        await tx.leadContact.upsert({
          where: {
            leadId_contactId: {
              leadId: createdLead.id,
              contactId: linked.id,
            },
          },
          create: {
            leadId: createdLead.id,
            contactId: linked.id,
            isPrimary: linked.isPrimary,
            role: linked.role,
          },
          update: {
            isPrimary: linked.isPrimary,
            role: linked.role,
          },
        });
      }

      return createdLead;
    });

    try {
      await ensureContactForLead(prisma, lead.id);
    } catch (error) {
      logLeadCreateSideEffectError("ensure-contact", error);
    }

    try {
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
    } catch (error) {
      logLeadCreateSideEffectError("activity-log", error);
    }

    try {
      await publishEntityEvent({
        type: CORE_EVENT_TYPES.LEAD_CREATED,
        entityType: "LEAD",
        entityId: lead.id,
        userId: sessionUserId,
        payload: {
          source: lead.source,
          ownerId: lead.ownerId,
        },
      });
    } catch (error) {
      logLeadCreateSideEffectError("публікації-entity-event", error);
    }

    try {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.LEAD_CREATED,
        { leadId: lead.id },
        {
          entityType: "LEAD",
          entityId: lead.id,
          userId: sessionUserId,
          dedupeKey: `lead-created:${lead.id}`,
        },
      );
    } catch (error) {
      logLeadCreateSideEffectError("workflow-event-lead-created", error);
    }

    try {
      await recordWorkflowEvent(
        WORKFLOW_EVENT_TYPES.LEAD_ASSIGNED,
        { leadId: lead.id, ownerId: lead.ownerId },
        {
          entityType: "LEAD",
          entityId: lead.id,
          userId: sessionUserId,
          dedupeKey: `lead-assigned:${lead.id}:${lead.ownerId}`,
        },
      );
    } catch (error) {
      logLeadCreateSideEffectError("workflow-event-lead-assigned", error);
    }

    try {
      revalidatePath("/leads");
      revalidatePath("/leads/new");
      revalidatePath("/leads/no-response");
      revalidatePath("/leads/no-next-step");
      revalidatePath("/leads/mine");
      revalidatePath("/leads/overdue");
      revalidatePath("/leads/duplicates");
      revalidatePath("/leads/re-contact");
      revalidatePath("/leads/closed");
      revalidatePath("/leads/converted");
      revalidatePath("/leads/unassigned");
      revalidatePath("/leads/qualified");
      revalidatePath("/leads/lost");
      revalidatePath("/leads/pipeline");
    } catch (error) {
      logLeadCreateSideEffectError("revalidate-leads-pages", error);
    }

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
        await publishEntityEvent({
          type: CORE_EVENT_TYPES.FILE_UPLOADED,
          entityType: "LEAD",
          entityId: lead.id,
          userId: sessionUserId,
          payload: {
            fileName: saved.originalName,
            category: multipartFileCategory,
          },
        });
        await recordWorkflowEvent(
          WORKFLOW_EVENT_TYPES.FILE_UPLOADED,
          { leadId: lead.id, attachmentId },
          {
            entityType: "LEAD",
            entityId: lead.id,
            userId: sessionUserId,
            dedupeKey: `file-uploaded:${attachmentId}`,
          },
        );
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
      try {
        revalidatePath(`/leads/${lead.id}`);
        revalidatePath(`/leads/${lead.id}/files`);
      } catch (error) {
        logLeadCreateSideEffectError("revalidate-lead-files", error);
      }
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
