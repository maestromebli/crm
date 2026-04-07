import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import {
  ownerIdWhere,
  resolveAccessContext,
} from "../../../../../lib/authz/data-scope";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../lib/authz/api-guard";
import { P } from "../../../../../lib/authz/permissions";
import {
  isConstructorSlaOverdue,
  matchesConstructorBoardFilter,
  parseConstructorBoardFilter,
} from "../../../../../lib/production/constructors-board-filter";
import { getPublicOriginFromRequest } from "../../../../../lib/request-origin";

const STATUS_UA: Record<string, string> = {
  PENDING_ASSIGNMENT: "Не відкрита",
  SENT_TO_CONSTRUCTOR: "Надіслано",
  IN_PROGRESS: "У роботі",
  DELIVERED: "Здано",
  REVIEWED: "Перевірено",
};

const PRIORITY_UA: Record<string, string> = {
  LOW: "Низький",
  NORMAL: "Звичайний",
  HIGH: "Високий",
  URGENT: "Терміново",
};

function csvEscape(cell: string): string {
  return `"${cell.replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.PRODUCTION_LAUNCH);
  if (denied) return denied;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const filter = parseConstructorBoardFilter(
    url.searchParams.get("filter"),
  );

  const access = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(access);

  const deals = await prisma.deal.findMany({
    where: {
      ...(ownerWhere ? { ownerId: ownerWhere } : {}),
      productionFlow: { isNot: null },
      handoff: { is: { status: "ACCEPTED" } },
    },
    orderBy: { updatedAt: "desc" },
    take: 2000,
    select: {
      id: true,
      title: true,
      updatedAt: true,
      client: { select: { name: true } },
      constructorRoom: {
        select: {
          status: true,
          publicToken: true,
          priority: true,
          dueAt: true,
          deliveredAt: true,
          externalConstructorLabel: true,
          assignedUser: { select: { name: true, email: true } },
        },
      },
    },
  });

  const publicOrigin = getPublicOriginFromRequest(req);

  const filtered = deals.filter((d) =>
    matchesConstructorBoardFilter(
      {
        title: d.title,
        clientName: d.client.name,
        room: d.constructorRoom
          ? {
              status: d.constructorRoom.status,
              dueAt: d.constructorRoom.dueAt?.toISOString() ?? null,
            }
          : null,
      },
      q,
      filter,
    ),
  );

  const header = [
    "DealId",
    "Title",
    "Client",
    "PriorityUa",
    "DueAt",
    "StatusUa",
    "Internal",
    "External",
    "PublicPath",
    "PublicUrl",
    "OverdueSla",
    "UpdatedAt",
  ];

  const lines: string[][] = filtered.map((d) => {
    const cr = d.constructorRoom;
    const overdueSla = isConstructorSlaOverdue(
      cr
        ? {
            status: cr.status,
            dueAt: cr.dueAt?.toISOString() ?? null,
          }
        : null,
    )
      ? "yes"
      : "";

    const internal = cr?.assignedUser
      ? cr.assignedUser.name?.trim() || cr.assignedUser.email
      : "";
    const publicPath = cr?.publicToken ? `/c/${cr.publicToken}` : "";
    const publicUrl =
      publicPath && publicOrigin ? `${publicOrigin}${publicPath}` : "";

    return [
      d.id,
      d.title,
      d.client.name,
      cr ? PRIORITY_UA[cr.priority] ?? cr.priority : "",
      cr?.dueAt?.toISOString() ?? "",
      cr ? STATUS_UA[cr.status] ?? cr.status : "",
      internal,
      cr?.externalConstructorLabel ?? "",
      publicPath,
      publicUrl,
      overdueSla,
      d.updatedAt.toISOString(),
    ];
  });

  const csvBody = [header, ...lines]
    .map((row) => row.map((c) => csvEscape(String(c))).join(","))
    .join("\n");

  const bom = "\uFEFF";
  const filename = `constructors-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(bom + csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
