import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { DealContractStatus } from "@prisma/client";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { markPrimaryContactCustomerOnContractFullySigned } from "@/lib/contacts/mark-contact-customer";
import { prisma } from "@/lib/prisma";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { persistReadinessSnapshot } from "@/lib/deal-api/persist-readiness";
import { dispatchDealAutomationTrigger } from "@/lib/automation/dispatch";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import {
  DEAL_DOCUMENT_TEMPLATES,
  makeDefaultDraft,
  parseRecipientType,
} from "@/lib/deals/document-templates";
import { requireDatabaseUrl } from "@/lib/api/route-guards";
import type {
  DealContractDraft,
  DealContractRecipientType,
} from "@/lib/deal-core/workspace-types";
import { renderDealContractPdf } from "@/lib/deals/render-deal-contract-pdf";
import { saveDealBufferPrivate } from "@/lib/uploads/lead-disk-upload";
import { closeDiiaSignatureStaleTasks } from "@/lib/diia/signature-stale-task";
import { seedDealPaymentPlan7030 } from "@/lib/deals/payment-milestones";
import { publishCrmEvent, CRM_EVENT_TYPES } from "@/lib/events/crm-events";

type Ctx = { params: Promise<{ dealId: string }> };

function isContractStatus(v: string): v is DealContractStatus {
  return [
    "DRAFT",
    "GENERATED",
    "EDITED",
    "PENDING_INTERNAL_APPROVAL",
    "APPROVED_INTERNAL",
    "SENT_FOR_SIGNATURE",
    "VIEWED_BY_CLIENT",
    "CLIENT_SIGNED",
    "COMPANY_SIGNED",
    "FULLY_SIGNED",
    "DECLINED",
    "EXPIRED",
    "SUPERSEDED",
  ].includes(v);
}

export async function POST(_req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        title: true,
        value: true,
        currency: true,
        ownerId: true,
        client: { select: { name: true, type: true } },
        contract: { select: { id: true } },
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.CONTRACTS_CREATE, {
      ownerId: deal.ownerId,
    });
    if (denied) return denied;

    const userId = user.id;
    if (deal.contract) {
      return NextResponse.json(
        { error: "Договір для цієї угоди вже існує" },
        { status: 409 },
      );
    }

    const defaultTemplate = DEAL_DOCUMENT_TEMPLATES[0];
    const initialDraft = makeDefaultDraft({
      template: defaultTemplate,
      clientName: deal.client.name,
      dealTitle: deal.title,
      dealValue: deal.value ?? null,
      dealCurrency: deal.currency ?? "UAH",
      recipientType: deal.client.type === "COMPANY" ? "CLIENT_COMPANY" : "CLIENT_PERSON",
    });

    await prisma.dealContract.create({
      data: {
        dealId,
        status: "DRAFT",
        templateKey: defaultTemplate.key,
        content: initialDraft as unknown as object,
      },
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "CONTRACT_CREATED",
      actorUserId: userId,
      data: {},
    });

    await persistReadinessSnapshot(dealId, userId);
    await dispatchDealAutomationTrigger({
      dealId,
      trigger: "CONTRACT_CREATED",
      startedById: userId,
    });

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({ ok: true });
  } catch (e) {
     
    console.error("[POST deal contract]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  let body: {
    status?: string;
    action?:
      | "applyTemplate"
      | "saveDraft"
      | "createVersion"
      | "startDiiaSign"
      | "generatePdf"
      | "generateDocx"
      | "sendClientPreview";
    templateKey?: string;
    recipientType?: DealContractRecipientType;
    documentType?: "CONTRACT" | "SPEC";
    format?: "HTML" | "DOCX";
    variables?: Record<string, string>;
    contentHtml?: string;
    contentJson?: Record<string, unknown> | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    (typeof body.status !== "string" || !isContractStatus(body.status))
  ) {
    return NextResponse.json({ error: "Некоректний статус договору" }, { status: 400 });
  }

  try {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: {
        ownerId: true,
        title: true,
        value: true,
        currency: true,
        client: { select: { name: true, type: true } },
      },
    });
    if (!deal) {
      return NextResponse.json({ error: "Угоду не знайдено" }, { status: 404 });
    }

    const denied = await forbidUnlessDealAccess(user, P.CONTRACTS_UPDATE, deal);
    if (denied) return denied;

    const userId = user.id;

    const row = await prisma.dealContract.findUnique({
      where: { dealId },
    });
    if (!row) {
      return NextResponse.json(
        { error: "Спочатку створіть запис договору" },
        { status: 404 },
      );
    }

    const patch: {
      status?: DealContractStatus;
      templateKey?: string | null;
      content?: object;
      version?: number;
      signedPdfUrl?: string | null;
    } = {};

    if (body.status) patch.status = body.status as DealContractStatus;

    const existingDraftRaw =
      row.content && typeof row.content === "object" && !Array.isArray(row.content)
        ? (row.content as Record<string, unknown>)
        : {};
    const existingDraft: DealContractDraft = {
      documentType: existingDraftRaw.documentType === "SPEC" ? "SPEC" : "CONTRACT",
      format: existingDraftRaw.format === "DOCX" ? "DOCX" : "HTML",
      templateKey:
        typeof existingDraftRaw.templateKey === "string"
          ? existingDraftRaw.templateKey
          : row.templateKey ?? "contract_basic_html",
      recipientType: parseRecipientType(existingDraftRaw.recipientType),
      variables:
        existingDraftRaw.variables &&
        typeof existingDraftRaw.variables === "object" &&
        !Array.isArray(existingDraftRaw.variables)
          ? (existingDraftRaw.variables as Record<string, string>)
          : {},
      contentHtml:
        typeof existingDraftRaw.contentHtml === "string"
          ? existingDraftRaw.contentHtml
          : "",
      contentJson:
        existingDraftRaw.contentJson &&
        typeof existingDraftRaw.contentJson === "object" &&
        !Array.isArray(existingDraftRaw.contentJson)
          ? (existingDraftRaw.contentJson as Record<string, unknown>)
          : null,
    };

    if (body.action === "applyTemplate") {
      const tpl = DEAL_DOCUMENT_TEMPLATES.find((t) => t.key === body.templateKey);
      if (!tpl) {
        return NextResponse.json({ error: "Шаблон не знайдено" }, { status: 400 });
      }
      const draft = makeDefaultDraft({
        template: tpl,
        clientName: deal.client.name,
        dealTitle: deal.title,
        dealValue: deal.value ?? null,
        dealCurrency: deal.currency ?? "UAH",
        recipientType: body.recipientType ?? existingDraft.recipientType,
      });
      patch.templateKey = tpl.key;
      patch.content = draft as unknown as object;
    } else if (body.action === "saveDraft") {
      const draft: DealContractDraft = {
        documentType: body.documentType ?? existingDraft.documentType,
        format: body.format ?? existingDraft.format,
        templateKey: body.templateKey ?? existingDraft.templateKey,
        recipientType: body.recipientType ?? existingDraft.recipientType,
        variables: body.variables ?? existingDraft.variables,
        contentHtml: body.contentHtml ?? existingDraft.contentHtml,
        contentJson:
          body.contentJson !== undefined ? body.contentJson : existingDraft.contentJson,
      };
      patch.templateKey = draft.templateKey;
      patch.content = draft as unknown as object;
    } else if (body.action === "createVersion") {
      const draft = {
        ...existingDraft,
        ...(body.documentType ? { documentType: body.documentType } : {}),
        ...(body.format ? { format: body.format } : {}),
        ...(body.templateKey ? { templateKey: body.templateKey } : {}),
        ...(body.recipientType ? { recipientType: body.recipientType } : {}),
        ...(body.variables ? { variables: body.variables } : {}),
        ...(body.contentHtml ? { contentHtml: body.contentHtml } : {}),
        ...(body.contentJson !== undefined ? { contentJson: body.contentJson } : {}),
      } satisfies DealContractDraft;
      const createdVersion = await prisma.dealContractVersion.create({
        data: {
          contractId: row.id,
          revision: row.version + 1,
          lifecycleStatus: patch.status ?? row.status,
          templateKey: draft.templateKey,
          content: draft as unknown as object,
          createdById: userId,
        },
      });
      patch.version = row.version + 1;
      patch.templateKey = draft.templateKey;
      patch.content = draft as unknown as object;
      patch.status = patch.status ?? row.status;
      await prisma.dealContract.update({
        where: { dealId },
        data: {
          ...patch,
          currentVersionId: createdVersion.id,
        },
      });
    } else if (body.action === "startDiiaSign") {
      await closeDiiaSignatureStaleTasks({
        dealId,
        resultComment: "Автозакрито: сесію Дія.Підпис перезапущено",
      });
      const draft = {
        ...existingDraft,
        ...(body.templateKey ? { templateKey: body.templateKey } : {}),
        ...(body.variables ? { variables: body.variables } : {}),
        ...(body.contentHtml ? { contentHtml: body.contentHtml } : {}),
        ...(body.contentJson !== undefined ? { contentJson: body.contentJson } : {}),
      } satisfies DealContractDraft;
      patch.templateKey = draft.templateKey;
      patch.content = draft as unknown as object;
      patch.status = "SENT_FOR_SIGNATURE";
      await prisma.dealContract.update({
        where: { dealId },
        data: {
          ...patch,
          diiaSessionId: `diia_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        },
      });
    } else if (body.action === "generatePdf") {
      const draft = {
        ...existingDraft,
        ...(body.templateKey ? { templateKey: body.templateKey } : {}),
        ...(body.variables ? { variables: body.variables } : {}),
        ...(body.contentHtml ? { contentHtml: body.contentHtml } : {}),
      } satisfies DealContractDraft;
      const pdfBytes = await renderDealContractPdf({
        title: `Договір · ${dealId}`,
        contentHtml: draft.contentHtml,
        variables: draft.variables,
      });
      const attachmentId = randomUUID();
      const saved = await saveDealBufferPrivate({
        dealId,
        attachmentId,
        buffer: Buffer.from(pdfBytes),
        fileName: `contract-${dealId}.pdf`,
        mimeType: "application/pdf",
      });
      await prisma.attachment.create({
        data: {
          id: attachmentId,
          fileName: saved.originalName,
          fileUrl: saved.fileUrl,
          storageKey: saved.storageKey,
          mimeType: saved.mimeType,
          fileSize: saved.bytes,
          category: "CONTRACT",
          entityType: "DEAL",
          entityId: dealId,
          uploadedById: userId,
        },
      });
      patch.templateKey = draft.templateKey;
      patch.content = draft as unknown as object;
      patch.signedPdfUrl = saved.fileUrl;
      await prisma.dealContract.update({
        where: { dealId },
        data: patch,
      });
    } else if (body.action === "generateDocx") {
      const draft = {
        ...existingDraft,
        ...(body.templateKey ? { templateKey: body.templateKey } : {}),
        ...(body.variables ? { variables: body.variables } : {}),
        ...(body.contentHtml ? { contentHtml: body.contentHtml } : {}),
      } satisfies DealContractDraft;
      const plain = draft.contentHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const title =
        draft.documentType === "SPEC" ? "СПЕЦИФІКАЦІЯ" : "ДОГОВІР";
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              new Paragraph({
                children: [new TextRun({ text: title, bold: true, size: 32 })],
              }),
              new Paragraph({ text: "" }),
              new Paragraph({ text: plain || "Документ без тексту." }),
            ],
          },
        ],
      });
      const buffer = await Packer.toBuffer(doc);
      const attachmentId = randomUUID();
      const fileBase = draft.documentType === "SPEC" ? "spec" : "contract";
      const saved = await saveDealBufferPrivate({
        dealId,
        attachmentId,
        buffer,
        fileName: `${fileBase}-${dealId}.docx`,
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const category = draft.documentType === "SPEC" ? "SPEC" : "CONTRACT";
      await prisma.attachment.create({
        data: {
          id: attachmentId,
          fileName: saved.originalName,
          fileUrl: saved.fileUrl,
          storageKey: saved.storageKey,
          mimeType: saved.mimeType,
          fileSize: saved.bytes,
          category,
          entityType: "DEAL",
          entityId: dealId,
          uploadedById: userId,
        },
      });
      patch.templateKey = draft.templateKey;
      patch.content = draft as unknown as object;
      await prisma.dealContract.update({
        where: { dealId },
        data: patch,
      });
    } else if (body.action === "sendClientPreview") {
      patch.status = "VIEWED_BY_CLIENT";
      await prisma.dealContract.update({
        where: { dealId },
        data: patch,
      });
    } else {
      if (Object.keys(patch).length === 0) {
        return NextResponse.json(
          { error: "Немає полів для оновлення" },
          { status: 400 },
        );
      }
      await prisma.dealContract.update({
        where: { dealId },
        data: patch,
      });
    }

    const resultingStatus = patch.status ?? row.status;

    if (resultingStatus === "FULLY_SIGNED") {
      const contactId = await markPrimaryContactCustomerOnContractFullySigned(
        dealId,
      );
      if (contactId) {
        revalidatePath(`/contacts/${contactId}`);
      }
      const dealForPlan = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { value: true, currency: true },
      });
      if (
        dealForPlan?.value != null &&
        dealForPlan.value > 0 &&
        !(await prisma.dealPaymentPlan.findUnique({
          where: { dealId },
          select: { id: true },
        }))
      ) {
        await seedDealPaymentPlan7030(prisma, {
          dealId,
          total: dealForPlan.value,
          currency: dealForPlan.currency?.trim() || "UAH",
        });
      }
      await publishCrmEvent({
        type: CRM_EVENT_TYPES.CONTRACT_SIGNED,
        dealId,
        payload: { status: resultingStatus },
        dedupeKey: `contract:signed:${dealId}:${row.id}:${patch.version ?? row.version}`,
      });
    }
    if (
      resultingStatus === "FULLY_SIGNED" ||
      resultingStatus === "DECLINED" ||
      resultingStatus === "EXPIRED"
    ) {
      await closeDiiaSignatureStaleTasks({
        dealId,
        resultComment: `Автозакрито по статусу договору: ${resultingStatus}`,
      });
    }

    await appendActivityLog({
      entityType: "DEAL",
      entityId: dealId,
      type: "CONTRACT_STATUS_CHANGED",
      actorUserId: userId,
      data: {
        status: resultingStatus,
        action: body.action ?? "status_only",
      },
    });

    await persistReadinessSnapshot(dealId, userId);
    await dispatchDealAutomationTrigger({
      dealId,
      trigger: "CONTRACT_STATUS_CHANGED",
      payload: { status: resultingStatus, action: body.action ?? null },
      startedById: userId,
    });

    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({
      ok: true,
      status: resultingStatus,
      action: body.action ?? null,
    });
  } catch (e) {
     
    console.error("[PATCH deal contract]", e);
    return NextResponse.json({ error: "Помилка збереження" }, { status: 500 });
  }
}
