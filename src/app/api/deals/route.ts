import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { appendActivityLog } from "@/lib/deal-api/audit";
import { resolveDefaultDealStage } from "@/lib/deals/resolve-default-stage";
import { prisma } from "@/lib/prisma";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { requireDatabaseUrl } from "@/lib/api/route-guards";

type CreateDealBody = {
  title?: string;
  clientName?: string;
  description?: string | null;
};

async function ensureFallbackDealStage(): Promise<{
  pipelineId: string;
  stageId: string;
}> {
  const existingPipeline = await prisma.pipeline.findFirst({
    where: { entityType: "DEAL" },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });

  if (existingPipeline) {
    const existingStage =
      existingPipeline.stages.find((stage) => !stage.isFinal) ??
      existingPipeline.stages[0];
    if (existingStage) {
      return { pipelineId: existingPipeline.id, stageId: existingStage.id };
    }
    const createdStage = await prisma.pipelineStage.create({
      data: {
        pipelineId: existingPipeline.id,
        name: "Нове",
        slug: "new",
        sortOrder: 0,
        isFinal: false,
      },
      select: { id: true },
    });
    return { pipelineId: existingPipeline.id, stageId: createdStage.id };
  }

  const createdPipeline = await prisma.pipeline.create({
    data: {
      name: "Воронка замовлень",
      entityType: "DEAL",
      isDefault: true,
      stages: {
        create: [
          {
            name: "Нове",
            slug: "new",
            sortOrder: 0,
            isFinal: false,
          },
        ],
      },
    },
    include: {
      stages: {
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      },
    },
  });

  const stageId = createdPipeline.stages[0]?.id;
  if (!stageId) {
    throw new Error("Не вдалося створити стартову стадію для замовлень");
  }

  return { pipelineId: createdPipeline.id, stageId };
}

export async function POST(req: Request) {
  const dbNotReady = requireDatabaseUrl();
  if (dbNotReady) return dbNotReady;

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.DEALS_CREATE);
  if (denied) return denied;

  let body: CreateDealBody = {};
  try {
    body = (await req.json()) as CreateDealBody;
  } catch {
    body = {};
  }

  const inputTitle = typeof body.title === "string" ? body.title.trim() : "";
  const inputClientName =
    typeof body.clientName === "string" ? body.clientName.trim() : "";
  const description =
    body.description === null || body.description === undefined
      ? null
      : String(body.description).trim() || null;

  const clientName = inputClientName || "Клієнт без назви";
  const title = inputTitle || `Замовлення · ${clientName}`;

  let stage = await resolveDefaultDealStage();
  if (!stage) {
    stage = await ensureFallbackDealStage();
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: clientName,
          type: "PERSON",
        },
        select: { id: true },
      });

      const deal = await tx.deal.create({
        data: {
          title,
          description,
          ownerId: user.id,
          clientId: client.id,
          pipelineId: stage.pipelineId,
          stageId: stage.stageId,
        },
        select: { id: true },
      });

      return deal;
    });

    await appendActivityLog({
      entityType: "DEAL",
      entityId: created.id,
      type: "DEAL_CREATED",
      actorUserId: user.id,
      data: {
        source: "manual_without_lead",
      },
    });

    revalidatePath("/deals");
    revalidatePath("/deals/pipeline");
    revalidatePath(`/deals/${created.id}/workspace`);

    return NextResponse.json({
      ok: true,
      dealId: created.id,
    });
  } catch (e) {
    console.error("[POST deals]", e);
    return NextResponse.json(
      { error: "Не вдалося створити замовлення" },
      { status: 500 },
    );
  }
}
