import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canAccessOwner, resolveAccessContext } from "@/lib/authz/data-scope";
import { canProcurementAction } from "@/features/procurement/lib/permissions";

type Line = {
  name?: string;
  qty?: number;
  plannedUnitCost?: number;
  itemType?: "stock" | "project";
  projectId?: string | null;
  clientOrderId?: string | null;
  unit?: string;
  supplierId?: string | null;
  warehouseId?: string | null;
};
const ALLOWED_PRIORITIES = new Set(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const CONSTRUCTOR_WORKSPACE_SOURCE = "constructor_workspace";

async function hasConstructorApprovalGate(dealId: string): Promise<boolean> {
  const [workspace, flow] = await Promise.all([
    prisma.constructorWorkspace.findUnique({
      where: { dealId },
      select: { status: true },
    }),
    prisma.productionFlow.findUnique({
      where: { dealId },
      select: {
        currentStepKey: true,
        approvals: {
          where: { status: "APPROVED" },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  const workspaceApproved =
    workspace?.status === "APPROVED" || workspace?.status === "HANDED_OFF_TO_PRODUCTION";
  const flowApproved =
    flow?.currentStepKey === "APPROVED_BY_CHIEF" ||
    flow?.currentStepKey === "TASKS_DISTRIBUTED" ||
    (flow?.approvals.length ?? 0) > 0;
  return workspaceApproved || flowApproved;
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canProcurementAction(user, "procurement.request.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    const body = (await req.json()) as {
      dealId?: string;
      sourceContext?: string | null;
      lines?: Line[];
      neededByDate?: string | null;
      priority?: string | null;
      comment?: string | null;
      supplierId?: string | null;
      currency?: string | null;
    };

    const dealId = body.dealId?.trim() ?? "";
    if (!dealId) {
      return NextResponse.json({ error: "Оберіть замовлення (проєкт)" }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }
    const access = await resolveAccessContext(prisma, {
      id: user.id,
      role: user.dbRole,
    });
    if (!canAccessOwner(access, deal.ownerId)) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }

    const lines = (body.lines ?? []).filter((l) => (l.name ?? "").trim().length > 0);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Додайте хоча б одну позицію з назвою" }, { status: 400 });
    }

    const neededByDateRaw = body.neededByDate?.trim() ?? "";
    const neededByDate = neededByDateRaw ? new Date(`${neededByDateRaw}T12:00:00.000Z`) : null;
    if (neededByDate && Number.isNaN(neededByDate.getTime())) {
      return NextResponse.json({ error: "Невірний формат дати потреби" }, { status: 400 });
    }

    const priorityCandidate = (body.priority ?? "MEDIUM").trim().toUpperCase() || "MEDIUM";
    const priority = ALLOWED_PRIORITIES.has(priorityCandidate) ? priorityCandidate : "MEDIUM";
    const supplierId = body.supplierId?.trim() || null;
    const currency = (body.currency?.trim() || "UAH").toUpperCase();
    const sourceContext = (body.sourceContext ?? "").trim().toLowerCase();

    if (sourceContext === CONSTRUCTOR_WORKSPACE_SOURCE) {
      const approvedForProcurement = await hasConstructorApprovalGate(dealId);
      if (!approvedForProcurement) {
        return NextResponse.json(
          {
            error:
              "Заявку із воркспейсу конструктора можна створити лише після погодження начальником виробництва або головним конструктором.",
          },
          { status: 409 },
        );
      }
    }

    const created = await prisma.procurementRequest.create({
      data: {
        number: `PR-${Date.now().toString(36).toUpperCase()}`,
        dealId,
        requesterId: user.id,
        responsibleUserId: user.id,
        source: sourceContext === CONSTRUCTOR_WORKSPACE_SOURCE ? "CONSTRUCTOR_WORKSPACE" : "CRM_UI",
        status: "DRAFT",
        workflowStatus: "new_request",
        approvalStatus: "PENDING_PREPARE",
        supplierId,
        priority,
        neededByDate,
        requestDate: new Date(),
        currency,
        comment: body.comment?.trim() || null,
        items: {
          create: lines.map((line) => {
            const qty = Math.max(0.001, Number(line.qty ?? 1) || 1);
            const unit = Math.max(0, Number(line.plannedUnitCost ?? 0) || 0);
            const itemType = line.itemType === "project" ? "project" : "stock";
            return {
              name: line.name!.trim(),
              unit: line.unit?.trim() || "шт",
              itemType,
              projectId: line.projectId?.trim() || (itemType === "project" ? dealId : null),
              clientOrderId: line.clientOrderId?.trim() || null,
              reservationStatus: "none",
              warehouseId: line.warehouseId?.trim() || null,
              qtyPlanned: qty,
              qtyOrdered: 0,
              qtyReceived: 0,
              qtyIssued: 0,
              plannedPrice: unit,
              actualPrice: 0,
              costPlanned: unit,
              costActual: 0,
              supplierId: line.supplierId?.trim() || null,
              status: "DRAFT",
              comment: null,
            };
          }),
        },
      },
      include: { items: true },
    });

    return NextResponse.json({ request: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Помилка сервера";
    console.error("[api/crm/procurement/requests]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
