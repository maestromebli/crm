import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authz/api-guard";
import {
  leadWhereForAccess,
  ownerIdWhere,
  resolveAccessContext,
} from "@/lib/authz/data-scope";
import { taskListWhereForUser } from "@/lib/tasks/prisma-scope";

export async function GET() {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const ctx = await resolveAccessContext(prisma, { id: user.id, role: user.dbRole });
  const leadWhere = leadWhereForAccess(ctx) ?? {};
  const ownerScope = ownerIdWhere(ctx);
  const dealWhere = ownerScope ? { ownerId: ownerScope } : {};
  const taskWhere = await taskListWhereForUser(prisma, user);

  const [latestLead, latestDeal, latestTask, latestEvent] = await Promise.all([
    prisma.lead.findFirst({
      where: leadWhere,
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.deal.findFirst({
      where: dealWhere,
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.task.findFirst({
      where: taskWhere,
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.domainEvent.findFirst({
      where: { deal: { is: dealWhere } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const stamps = [
    latestLead?.updatedAt?.toISOString() ?? "",
    latestDeal?.updatedAt?.toISOString() ?? "",
    latestTask?.updatedAt?.toISOString() ?? "",
    latestEvent?.createdAt?.toISOString() ?? "",
  ];

  return NextResponse.json({
    pulseKey: stamps.join("|"),
    refreshedAt: new Date().toISOString(),
  });
}
