import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";
import {
  canTransitionWorkflow,
  canUserTransitionWorkflow,
  isProcurementWorkflowStatus,
  normalizeWorkflowStatus,
  validateTransitionRequirements,
  type ProcurementWorkflowStatus,
} from "@/features/procurement/lib/workflow";

type Params = {
  params: Promise<{ requestId: string }>;
};

type TransitionBody = {
  toStatus?: string;
  reason?: string | null;
  invoiceAttachmentUrl?: string | null;
  invoiceAmount?: number | null;
  paymentMethod?: string | null;
  paymentFop?: string | null;
  paymentExecutor?: string | null;
  paymentDate?: string | null;
  paymentAmount?: number | null;
  paymentReference?: string | null;
  goodsReceivedAt?: string | null;
  accountingDocumentRef?: string | null;
};

function parseDateOrNull(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function mapLegacyStatus(
  toStatus: ProcurementWorkflowStatus,
  allItemsReceived: boolean,
): string | null {
  if (toStatus === "new_request" || toStatus === "in_progress_by_purchaser") {
    return "DRAFT";
  }
  if (
    toStatus === "ai_grouping" ||
    toStatus === "grouped_by_supplier_or_category" ||
    toStatus === "sent_to_supplier" ||
    toStatus === "supplier_response_received" ||
    toStatus === "supplier_invoice_uploaded" ||
    toStatus === "invoice_ai_matched" ||
    toStatus === "invoice_verification"
  ) {
    return "ORDERED";
  }
  if (toStatus === "approval_pending") return "PENDING_APPROVAL";
  if (toStatus === "sent_to_payment" || toStatus === "payment_method_selected") return "APPROVED";
  if (
    toStatus === "paid" ||
    toStatus === "receipt_verification_pending" ||
    toStatus === "awaiting_delivery"
  ) {
    return "ORDERED";
  }
  if (toStatus === "goods_received") {
    return allItemsReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
  }
  if (
    toStatus === "stock_posted" ||
    toStatus === "reserved_for_order" ||
    toStatus === "issued_to_production"
  ) {
    return "CLOSED";
  }
  if (toStatus === "rejected") return "CANCELLED";
  if (toStatus === "returned_for_revision") return "DRAFT";
  return null;
}

export async function PATCH(req: Request, { params }: Params) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }

  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const { requestId } = await params;
    if (!requestId?.trim()) {
      return NextResponse.json({ error: "Не вказано ідентифікатор заявки" }, { status: 400 });
    }

    const body = (await req.json()) as TransitionBody;
    if (!isProcurementWorkflowStatus(body.toStatus)) {
      return NextResponse.json({ error: "Невірний цільовий статус" }, { status: 400 });
    }
    const toStatus = body.toStatus;

    const entity = await prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: {
        deal: { select: { ownerId: true } },
        items: {
          select: {
            id: true,
            supplierId: true,
            itemType: true,
            projectId: true,
            qtyReceived: true,
            qtyIssued: true,
            warehouseId: true,
          },
        },
      },
    });
    if (!entity) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, entity.deal.ownerId)) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const fromStatus = normalizeWorkflowStatus(entity.workflowStatus);
    if (!canTransitionWorkflow(fromStatus, toStatus)) {
      return NextResponse.json(
        { error: `Перехід ${fromStatus} -> ${toStatus} недозволений` },
        { status: 409 },
      );
    }
    if (!canUserTransitionWorkflow(user, toStatus)) {
      return NextResponse.json({ error: "Недостатньо ролі для цього переходу" }, { status: 403 });
    }

    const incomingInvoiceAttachment = body.invoiceAttachmentUrl ?? entity.invoiceAttachmentUrl;
    const incomingInvoiceAmount = Number(body.invoiceAmount ?? entity.invoiceAmount ?? 0);
    const paymentMethod = (body.paymentMethod ?? "").trim();
    const paymentFop = (body.paymentFop ?? "").trim();
    const paymentExecutor = (body.paymentExecutor ?? "").trim();
    const paymentDate = parseDateOrNull(body.paymentDate) ?? entity.paymentDate;
    const paymentAmount = Number(body.paymentAmount ?? entity.paymentAmount ?? 0);
    const paymentReference = (body.paymentReference ?? entity.paymentReference ?? "").trim();
    const goodsReceivedAt = parseDateOrNull(body.goodsReceivedAt) ?? entity.goodsReceivedAt;
    const accountingDocumentRef = (
      body.accountingDocumentRef ??
      entity.accountingDocumentRef ??
      ""
    ).trim();

    const items = entity.items;
    const hasItems = items.length > 0;
    const hasSupplier = Boolean(entity.supplierId || items.some((item) => Boolean(item.supplierId)));
    const hasWarehousePlacement = items.every((item) => Boolean(item.warehouseId));
    const hasProjectItemsWithoutProject = items.some(
      (item) => (item.itemType ?? "stock") === "project" && !item.projectId,
    );
    const hasProjectItemsOverIssued = items.some(
      (item) => Number(item.qtyIssued ?? 0) > Number(item.qtyReceived ?? 0),
    );

    const validationErrors = validateTransitionRequirements(toStatus, {
      hasItems,
      hasSupplier,
      hasInvoiceAttachment: Boolean(incomingInvoiceAttachment),
      invoiceAmount: incomingInvoiceAmount,
      paymentMethod,
      paymentFop,
      paymentExecutor,
      paymentAmount,
      paymentDate,
      paymentReference,
      goodsReceivedAt,
      hasWarehousePlacement,
      hasAccountingDocument: Boolean(accountingDocumentRef),
      hasProjectItemsWithoutProject,
      hasProjectItemsOverIssued,
    });

    if (validationErrors.length) {
      return NextResponse.json(
        {
          error: "Порушені бізнес-правила переходу",
          details: validationErrors,
        },
        { status: 422 },
      );
    }

    const allItemsReceived = items.every(
      (item) => Number(item.qtyReceived ?? 0) >= Number(item.qtyIssued ?? 0),
    );
    const legacyStatus = mapLegacyStatus(toStatus, allItemsReceived);

    const updated = await prisma.$transaction(async (tx) => {
      const request = await tx.procurementRequest.update({
        where: { id: requestId },
        data: {
          workflowStatus: toStatus,
          status: legacyStatus ?? entity.status,
          approvalStatus: toStatus === "approval_pending" ? "PENDING" : entity.approvalStatus,
          invoiceAttachmentUrl: incomingInvoiceAttachment ?? null,
          invoiceAmount: Number.isFinite(incomingInvoiceAmount) ? incomingInvoiceAmount : null,
          paymentDate: toStatus === "paid" ? paymentDate : entity.paymentDate,
          paymentAmount: Number.isFinite(paymentAmount) ? paymentAmount : null,
          paymentReference: paymentReference || null,
          goodsReceivedAt: toStatus === "goods_received" ? goodsReceivedAt : entity.goodsReceivedAt,
          accountedAt: toStatus === "stock_posted" ? new Date() : entity.accountedAt,
          accountingDocumentRef: accountingDocumentRef || null,
          comment: body.reason?.trim()
            ? `${entity.comment ? `${entity.comment}\n` : ""}[${new Date().toISOString()}] ${body.reason.trim()}`
            : entity.comment,
        },
        select: {
          id: true,
          status: true,
          workflowStatus: true,
          approvalStatus: true,
          updatedAt: true,
        },
      });

      await tx.procurementRequestStatusHistory.create({
        data: {
          requestId,
          fromStatus,
          toStatus,
          actorId: user.id,
          actorRole: user.realRole,
          reason: body.reason?.trim() || null,
          payload: {
            paymentMethod: paymentMethod || null,
            paymentFop: paymentFop || null,
            paymentExecutor: paymentExecutor || null,
            invoiceAmount: incomingInvoiceAmount || null,
            paymentAmount: paymentAmount || null,
            paymentReference: paymentReference || null,
          },
        },
      });

      return request;
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests/[requestId]/status]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
