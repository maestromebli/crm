import { config } from "dotenv";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Потрібен DATABASE_URL у .env або .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function ensureDealStage() {
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
    const stage = await prisma.pipelineStage.create({
      data: {
        pipelineId: existingPipeline.id,
        name: "Нове",
        slug: "new",
        sortOrder: 0,
        isFinal: false,
      },
      select: { id: true },
    });
    return { pipelineId: existingPipeline.id, stageId: stage.id };
  }

  const created = await prisma.pipeline.create({
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
      stages: { orderBy: { sortOrder: "asc" }, select: { id: true } },
    },
  });

  return { pipelineId: created.id, stageId: created.stages[0].id };
}

async function resolveOwnerId() {
  const owner = await prisma.user.findFirst({
    where: {
      role: {
        in: ["SUPER_ADMIN", "ADMIN", "DIRECTOR", "HEAD_MANAGER", "MANAGER"],
      },
    },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true },
  });
  if (!owner) throw new Error("Не знайдено користувача для ownerId");
  return owner.id;
}

async function main() {
  const { pipelineId, stageId } = await ensureDealStage();
  const ownerId = await resolveOwnerId();

  const orders = await prisma.order.findMany({
    where: { source: "image-import-2026-04-21" },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      amount: true,
      currency: true,
      comment: true,
    },
  });

  let created = 0;
  let skipped = 0;

  for (const order of orders) {
    const marker = `[OrderImport:${order.id}]`;
    const exists = await prisma.deal.findFirst({
      where: { description: { contains: marker } },
      select: { id: true },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          name: order.customerName,
          type: "PERSON",
        },
        select: { id: true },
      });

      await tx.deal.create({
        data: {
          title: `${order.orderNumber} · ${order.customerName}`,
          description: `${marker}\nІмпортовано зі скріншота замовлень`,
          status: "OPEN",
          pipelineId,
          stageId,
          clientId: client.id,
          ownerId,
          value: order.amount ?? null,
          currency: order.currency || "UAH",
          workspaceMeta: {
            source: "image-import-2026-04-21",
            orderId: order.id,
            orderNumber: order.orderNumber,
            importedFrom: "Order",
            originalComment: order.comment ?? null,
          },
        },
      });
    });

    created += 1;
  }

  console.log(
    JSON.stringify(
      {
        sourceOrders: orders.length,
        dealsCreated: created,
        skippedAlreadyPromoted: skipped,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
