import { NextResponse } from "next/server";
import { prisma } from "../prisma";
import type { SessionUser } from "../authz/api-guard";
import {
  forbidUnlessDealAccess,
  forbidUnlessLeadAccess,
} from "../authz/api-guard";
import { P } from "../authz/permissions";
import type { TaskEntityType } from "@prisma/client";

export async function assertTaskEntityAccess(
  user: SessionUser,
  entityType: TaskEntityType,
  entityId: string,
): Promise<NextResponse | null> {
  if (entityType === "DEAL") {
    const deal = await prisma.deal.findUnique({
      where: { id: entityId },
      select: { ownerId: true },
    });
    if (!deal) {
      return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
    }
    return await forbidUnlessDealAccess(user, P.TASKS_VIEW, deal);
  }
  const lead = await prisma.lead.findUnique({
    where: { id: entityId },
    select: { id: true, ownerId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  return await forbidUnlessLeadAccess(user, P.TASKS_VIEW, lead);
}
