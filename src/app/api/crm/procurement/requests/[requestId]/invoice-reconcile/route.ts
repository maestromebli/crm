import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

type Params = {
  params: Promise<{ requestId: string }>;
};

type ParsedSupplierLine = {
  index: number;
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
};

type MatchedRow = {
  itemId: string;
  supplierLineIndex: number;
  lineName: string;
  matchedBy: string;
  qtyOrdered: number;
  unitPrice: number;
};

function n(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function readPayloadArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value as T[];
}

export async function GET(_req: Request, { params }: Params) {
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

    const request = await prisma.procurementRequest.findUnique({
      where: { id: requestId },
      include: {
        deal: { select: { ownerId: true, title: true } },
        supplier: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            name: true,
            qtyPlanned: true,
            plannedPrice: true,
            qtyOrdered: true,
            actualPrice: true,
          },
        },
      },
    });
    if (!request) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, request.deal.ownerId)) {
      return NextResponse.json({ error: "Заявку не знайдено" }, { status: 404 });
    }

    const latestAiMatch = await prisma.procurementRequestStatusHistory.findFirst({
      where: {
        requestId,
        toStatus: "invoice_ai_matched",
      },
      orderBy: { createdAt: "desc" },
      select: {
        payload: true,
        createdAt: true,
      },
    });

    const payloadObj = (latestAiMatch?.payload ?? {}) as Record<string, unknown>;
    const parsedLines = readPayloadArray<ParsedSupplierLine>(payloadObj.parsedLines);
    const matchedRows = readPayloadArray<MatchedRow>(payloadObj.matchedRows);
    const matchedByItemId = new Map(matchedRows.map((row) => [row.itemId, row]));
    const parsedByIndex = new Map(parsedLines.map((line) => [line.index, line]));

    const lines = request.items.map((item) => {
      const plannedQty = n(item.qtyPlanned);
      const plannedUnitPrice = n(item.plannedPrice);
      const plannedTotal = plannedQty * plannedUnitPrice;
      const matched = matchedByItemId.get(item.id);
      const supplierLine = matched ? parsedByIndex.get(matched.supplierLineIndex) : undefined;
      const supplierQty = matched ? n(supplierLine?.qty ?? matched.qtyOrdered) : 0;
      const supplierUnitPrice = matched ? n(supplierLine?.unitPrice ?? matched.unitPrice) : 0;
      const supplierTotal = matched
        ? n(supplierLine?.total ?? supplierQty * supplierUnitPrice)
        : 0;
      const qtyDelta = supplierQty - plannedQty;
      const priceDelta = supplierUnitPrice - plannedUnitPrice;
      const totalDelta = supplierTotal - plannedTotal;
      const confidencePct = Number((matched?.matchedBy ?? "0").replace(/[^\d.]/g, "")) || 0;
      const status = !matched
        ? "missing"
        : Math.abs(priceDelta) > Math.max(1, plannedUnitPrice * 0.1) || Math.abs(qtyDelta) > 0.001
          ? "warning"
          : "ok";

      return {
        itemId: item.id,
        itemName: item.name ?? "Позиція",
        plannedQty,
        plannedUnitPrice,
        plannedTotal,
        supplierLineName: supplierLine?.name ?? matched?.lineName ?? null,
        supplierQty,
        supplierUnitPrice,
        supplierTotal,
        qtyDelta,
        priceDelta,
        totalDelta,
        confidencePct,
        status,
      };
    });

    const summary = {
      matchedItems: lines.filter((line) => line.supplierLineName).length,
      totalRequestItems: lines.length,
      totalSupplierLines: parsedLines.length,
      plannedTotal: lines.reduce((sum, line) => sum + line.plannedTotal, 0),
      supplierTotal: lines.reduce((sum, line) => sum + line.supplierTotal, 0),
      totalDelta: lines.reduce((sum, line) => sum + line.totalDelta, 0),
      warnings: lines.filter((line) => line.status === "warning").length,
      missing: lines.filter((line) => line.status === "missing").length,
    };

    return NextResponse.json({
      request: {
        id: request.id,
        number: request.number,
        dealTitle: request.deal.title,
        supplierName: request.supplier?.name ?? null,
        workflowStatus: request.workflowStatus ?? "new_request",
        invoiceAmount: n(request.invoiceAmount),
        aiMatchedAt: latestAiMatch?.createdAt?.toISOString() ?? null,
      },
      summary,
      lines,
      canConfirmForApproval:
        request.workflowStatus === "invoice_ai_matched" ||
        request.workflowStatus === "invoice_verification",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests/[requestId]/invoice-reconcile]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
