import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  ownerIdWhere,
  resolveAccessContext,
} from "../../../../lib/authz/data-scope";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import type { DealWorkspaceMeta } from "@/lib/deal-core/workspace-types";

function parseMeta(raw: unknown): DealWorkspaceMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as DealWorkspaceMeta;
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

  const access = await resolveAccessContext(prisma, {
    id: user.id,
    role: user.dbRole,
  });
  const ownerWhere = ownerIdWhere(access);
  const url = new URL(req.url);
  const onlyReady = url.searchParams.get("ready") === "1";

  const deals = await prisma.deal.findMany({
    where: {
      ...(ownerWhere ? { ownerId: ownerWhere } : {}),
      handoff: {
        is: {
          status: { in: onlyReady ? ["ACCEPTED"] : ["SUBMITTED", "ACCEPTED"] },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
    select: {
      id: true,
      title: true,
      ownerId: true,
      workspaceMeta: true,
      handoff: { select: { status: true, submittedAt: true, acceptedAt: true } },
      productionFlow: {
        select: { id: true, status: true, createdAt: true },
      },
      owner: { select: { name: true, email: true } },
      client: { select: { name: true } },
      stage: { select: { name: true } },
      updatedAt: true,
    },
  });

  return NextResponse.json({
    items: deals.map((d) => {
      const meta = parseMeta(d.workspaceMeta);
      const flow = d.productionFlow;
      const launched = Boolean(flow);
      const orderCreated = Boolean(meta.productionOrderCreated) || launched;
      return {
        id: d.id,
        title: d.title,
        ownerId: d.ownerId,
        ownerName: d.owner.name ?? d.owner.email,
        clientName: d.client.name,
        stageName: d.stage.name,
        handoffStatus: d.handoff?.status ?? null,
        submittedAt: d.handoff?.submittedAt?.toISOString() ?? null,
        acceptedAt: d.handoff?.acceptedAt?.toISOString() ?? null,
        productionOrderCreated: orderCreated,
        productionLaunchStatus: launched ? "LAUNCHED" : "NOT_READY",
        queuedAt: flow?.createdAt.toISOString() ?? null,
        launchedAt: flow?.createdAt.toISOString() ?? null,
        launchError: null,
        queueState: launched
          ? "launched"
          : d.handoff?.status === "ACCEPTED"
            ? "ready"
            : "waiting_acceptance",
        updatedAt: d.updatedAt.toISOString(),
      };
    }),
  });
}
