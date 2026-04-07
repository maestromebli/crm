import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

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

/** Узгоджено з `enum PermissionKey` у prisma/schema.prisma */
const PERMISSION_KEYS = [
  "DASHBOARD_VIEW",
  "LEADS_VIEW",
  "CONTACTS_VIEW",
  "CALENDAR_VIEW",
  "TASKS_VIEW",
  "ORDERS_VIEW",
  "PRODUCTS_VIEW",
  "REPORTS_VIEW",
  "REPORTS_EXPORT",
  "NOTIFICATIONS_VIEW",
  "ADMIN_PANEL_VIEW",
  "SETTINGS_VIEW",
  "LEADS_CREATE",
  "LEADS_UPDATE",
  "LEADS_ASSIGN",
  "DEALS_VIEW",
  "DEALS_CREATE",
  "DEALS_UPDATE",
  "DEALS_ASSIGN",
  "DEALS_STAGE_CHANGE",
  "TASKS_CREATE",
  "TASKS_UPDATE",
  "TASKS_ASSIGN",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "ESTIMATES_VIEW",
  "ESTIMATES_CREATE",
  "ESTIMATES_UPDATE",
  "QUOTES_CREATE",
  "CONTRACTS_VIEW",
  "CONTRACTS_CREATE",
  "CONTRACTS_UPDATE",
  "PAYMENTS_VIEW",
  "PAYMENTS_UPDATE",
  "COST_VIEW",
  "MARGIN_VIEW",
  "SETTINGS_MANAGE",
  "USERS_VIEW",
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "AUDIT_LOG_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "CONTRACT_VIEW",
  "CONTRACT_EDIT",
  "CONTRACT_APPROVE_INTERNAL",
  "CONTRACT_SEND_SIGNATURE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "READINESS_OVERRIDE_REQUEST",
  "READINESS_OVERRIDE_APPROVE",
  "HANDOFF_SUBMIT",
  "HANDOFF_ACCEPT",
  "PRODUCTION_LAUNCH",
  "PRODUCTION_ORDERS_VIEW",
  "PRODUCTION_ORDERS_MANAGE",
  "PRODUCTION_ORCHESTRATION_VIEW",
  "PRODUCTION_ORCHESTRATION_MANAGE",
  "PAYMENT_CONFIRM",
  "AI_USE",
  "AI_ANALYTICS",
];

/** Довідник матеріалів для пошуку в сметі (Viyar-стиль, локальний кеш). */
async function ensureMaterialCatalog(prisma) {
  try {
    const viyar = await prisma.materialProvider.upsert({
      where: { key: "viyar" },
      create: {
        key: "viyar",
        name: "Viyar (довідник)",
        kind: "catalog",
        isActive: true,
      },
      update: { isActive: true },
    });
    const rows = [
      {
        externalId: "dsp-egger-w980",
        category: "ДСП",
        brand: "Egger",
        name: "ДСП 18 мм білий W980 ST9",
        displayName: "Egger W980",
        unit: "л",
        price: 2850,
      },
      {
        externalId: "dsp-krono-k101",
        category: "ДСП",
        brand: "Kronospan",
        name: "ДСП 18 мм дуб K101",
        displayName: "Kronospan K101",
        unit: "л",
        price: 2420,
      },
      {
        externalId: "mdf-painted-white",
        category: "Фарбований МДФ",
        brand: "МДФ",
        name: "Фасад МДФ фарбований RAL9003",
        displayName: "МДФ фасад білий",
        unit: "м²",
        price: 4200,
      },
      {
        externalId: "blum-clip-top",
        category: "Фурнітура",
        brand: "Blum",
        name: "Петлі Blum Clip Top 110°",
        displayName: "Blum петлі",
        unit: "шт",
        price: 185,
      },
      {
        externalId: "hettich-runners",
        category: "Фурнітура",
        brand: "Hettich",
        name: "Направляючі повного висунення 450мм",
        displayName: "Hettich напрямні",
        unit: "пара",
        price: 920,
      },
      {
        externalId: "countertop-quartz",
        category: "Стільниця",
        brand: "Кварц",
        name: "Кварцова стільниця 38 мм біла",
        displayName: "Кварц 38мм",
        unit: "пог. м",
        price: 6500,
      },
    ];
    for (const it of rows) {
      await prisma.materialCatalogItem.upsert({
        where: {
          providerId_externalId: {
            providerId: viyar.id,
            externalId: it.externalId,
          },
        },
        create: {
          providerId: viyar.id,
          externalId: it.externalId,
          category: it.category,
          brand: it.brand,
          name: it.name,
          displayName: it.displayName,
          unit: it.unit,
          price: it.price,
          currency: "UAH",
          syncedAt: new Date(),
        },
        update: {
          price: it.price,
          name: it.name,
          displayName: it.displayName,
          syncedAt: new Date(),
        },
      });
    }
     
    console.log("Seed: каталог матеріалів (Viyar) оновлено.");
  } catch (e) {
     
    console.warn("Seed: каталог матеріалів пропущено:", e.message);
  }
}

/** Демо-записи для вкладки «Банки» (без секретів; API — через env у майбутньому конекторі). */
async function ensureBankIntegrations(prisma) {
  const rows = [
    {
      provider: "PRIVATBANK",
      displayName: "Розрахунковий рахунок · ПриватБанк",
      status: "DISCONNECTED",
      lastError: null,
      meta: { hint: "Задайте токен API у змінних середовища (див. документацію ПриватБанк для бізнесу)." },
    },
    {
      provider: "OSCHADBANK",
      displayName: "Ощадбанк · корпоративний кабінет",
      status: "DISCONNECTED",
      lastError: null,
      meta: { hint: "Підключення виписок через API або імпорт CSV — після налаштування." },
    },
  ];
  for (const row of rows) {
    const existing = await prisma.bankIntegration.findFirst({
      where: { provider: row.provider },
    });
    if (!existing) {
      await prisma.bankIntegration.create({ data: row });
    }
  }
  console.log("Seed: BankIntegration (ПриватБанк / Ощадбанк) перевірено.");
}

async function ensurePermissions() {
  for (const key of PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: {
        key,
        description: `Право: ${key}`,
      },
    });
  }
}

async function grantAllPermissions(userId) {
  const perms = await prisma.permission.findMany();
  for (const p of perms) {
    await prisma.permissionOnUser.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: p.id,
        },
      },
      update: {},
      create: { userId, permissionId: p.id },
    });
  }
}

/** Головний менеджер: повний операційний контур без керування обліковими записами та аудиту. */
const HEAD_MANAGER_EXCLUDED_KEYS = new Set([
  "USERS_MANAGE",
  "ROLES_MANAGE",
  "AUDIT_LOG_VIEW",
  "ADMIN_PANEL_VIEW",
]);

async function grantHeadManagerPermissions(userId) {
  const keys = PERMISSION_KEYS.filter((k) => !HEAD_MANAGER_EXCLUDED_KEYS.has(k));
  for (const key of keys) {
    const p = await prisma.permission.findUnique({ where: { key } });
    if (!p) continue;
    await prisma.permissionOnUser.upsert({
      where: {
        userId_permissionId: {
          userId,
          permissionId: p.id,
        },
      },
      update: {},
      create: { userId, permissionId: p.id },
    });
  }
}

/** Дефолтний workspace (одна організація / multi-tenant foundation). */
async function ensureDefaultWorkspace(prisma, { adminId, demoId, veraId }) {
  const ws = await prisma.workspace.upsert({
    where: { slug: "enver" },
    update: { name: "ENVER" },
    create: {
      name: "ENVER",
      slug: "enver",
      settingsJson: { kind: "furniture_factory", locale: "uk" },
    },
  });

  const members = [
    { userId: adminId, role: "OWNER" },
    { userId: demoId, role: "ADMIN" },
    { userId: veraId, role: "ADMIN" },
  ];

  for (const m of members) {
    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: ws.id,
          userId: m.userId,
        },
      },
      update: { role: m.role },
      create: {
        workspaceId: ws.id,
        userId: m.userId,
        role: m.role,
      },
    });
  }

  console.log(
    `Seed: Workspace «${ws.slug}» — ${members.length} учасників (OWNER/ADMIN).`,
  );
  return ws;
}

/**
 * Legacy-ролі без відповідника в новій політиці.
 * `ADMIN` більше не мігрує в DIRECTOR — це окрема роль «операційний адмін» (див. role-access-policy.ts).
 */
async function migrateLegacyRoles() {
  await prisma.user.updateMany({
    where: { role: "MANAGER" },
    data: { role: "HEAD_MANAGER" },
  });
  await prisma.user.updateMany({
    where: { role: "USER" },
    data: { role: "SALES_MANAGER" },
  });
}

async function main() {
  const adminPasswordHash = await bcrypt.hash("admin123", 10);
  const demoPasswordHash = await bcrypt.hash("demo123", 10);

  await ensurePermissions();
  await migrateLegacyRoles();

  const admin = await prisma.user.upsert({
    where: { email: "admin@enver.com" },
    update: {
      name: "Адміністратор",
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
    },
    create: {
      email: "admin@enver.com",
      name: "Адміністратор",
      passwordHash: adminPasswordHash,
      role: "SUPER_ADMIN",
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "demo@enver.local" },
    update: {
      name: "Demo директор",
      passwordHash: demoPasswordHash,
      role: "DIRECTOR",
    },
    create: {
      email: "demo@enver.local",
      name: "Demo директор",
      passwordHash: demoPasswordHash,
      role: "DIRECTOR",
    },
  });

  await grantAllPermissions(admin.id);
  await grantAllPermissions(user.id);

  const veraPasswordHash = await bcrypt.hash("vera123", 10);
  const vera = await prisma.user.upsert({
    where: { email: "vera.blochytska@enver.local" },
    update: {
      name: "Віра Блощицька",
      passwordHash: veraPasswordHash,
      role: "HEAD_MANAGER",
    },
    create: {
      email: "vera.blochytska@enver.local",
      name: "Віра Блощицька",
      passwordHash: veraPasswordHash,
      role: "HEAD_MANAGER",
    },
  });
  await grantHeadManagerPermissions(vera.id);

  await ensureDefaultWorkspace(prisma, {
    adminId: admin.id,
    demoId: user.id,
    veraId: vera.id,
  });

  let pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "LEAD", isDefault: true },
    include: { stages: true },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        name: "Основна воронка лідів",
        entityType: "LEAD",
        isDefault: true,
        stages: {
          create: [
            {
              name: "Новий",
              slug: "new",
              sortOrder: 0,
              isFinal: false,
            },
            {
              name: "В роботі",
              slug: "working",
              sortOrder: 1,
              isFinal: false,
            },
            {
              name: "Розрахунок",
              slug: "qualified",
              sortOrder: 2,
              isFinal: false,
            },
            {
              name: "Закритий — втрата",
              slug: "lost",
              sortOrder: 3,
              isFinal: true,
              finalType: "LOST",
            },
            {
              name: "Архів",
              slug: "archived",
              sortOrder: 4,
              isFinal: true,
              finalType: "CLOSED",
            },
          ],
        },
      },
      include: { stages: true },
    });
  }

  const stage = (slug) =>
    pipeline.stages.find((s) => s.slug === slug)?.id ??
    (() => {
      throw new Error(`Stage ${slug} not found`);
    })();

  let dealPipeline = await prisma.pipeline.findFirst({
    where: { entityType: "DEAL", isDefault: true },
    include: { stages: true },
  });

  if (!dealPipeline) {
    dealPipeline = await prisma.pipeline.create({
      data: {
        name: "Воронка угод (КП → договір → виробництво)",
        entityType: "DEAL",
        isDefault: true,
        stages: {
          create: [
            { name: "Кваліфікація", slug: "qualification", sortOrder: 0 },
            { name: "Замір", slug: "measurement", sortOrder: 1 },
            { name: "КП", slug: "proposal", sortOrder: 2 },
            { name: "Договір", slug: "contract", sortOrder: 3 },
            { name: "Оплата", slug: "payment", sortOrder: 4 },
            { name: "Передача", slug: "handoff", sortOrder: 5 },
            { name: "Виробництво", slug: "production", sortOrder: 6 },
            {
              name: "Успіх",
              slug: "won",
              sortOrder: 7,
              isFinal: true,
              finalType: "WON",
            },
          ],
        },
      },
      include: { stages: true },
    });
  }

  const dealStage = (slug) =>
    dealPipeline.stages.find((s) => s.slug === slug)?.id ??
    (() => {
      throw new Error(`Deal stage ${slug} not found`);
    })();

  const demoClient = await prisma.client.upsert({
    where: { id: "seed_client_demo" },
    update: {},
    create: {
      id: "seed_client_demo",
      name: "ТОВ Демо Клієнт",
      type: "COMPANY",
    },
  });

  const demoContact = await prisma.contact.upsert({
    where: { id: "seed_contact_demo" },
    update: {},
    create: {
      id: "seed_contact_demo",
      fullName: "Іван Демо",
      phone: "+380501112233",
      email: "ivan@demo.client",
      clientId: demoClient.id,
    },
  });

  const existingDeal = await prisma.deal.findFirst({
    where: { title: "Кухня · демо угода (робоче місце)" },
  });

  if (!existingDeal) {
    const d = await prisma.deal.create({
      data: {
        title: "Кухня · демо угода (робоче місце)",
        description: "Демонстрація єдиного робочого місця угоди",
        status: "OPEN",
        pipelineId: dealPipeline.id,
        stageId: dealStage("contract"),
        clientId: demoClient.id,
        primaryContactId: demoContact.id,
        ownerId: user.id,
        value: 420000,
        currency: "UAH",
        workspaceMeta: {
          health: "at_risk",
          subStatusLabel: "Очікує підпис клієнта",
          nextActionAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          measurementComplete: true,
          proposalSent: true,
          payment: {
            milestones: [
              {
                id: "prepay",
                label: "Передоплата 40%",
                amount: 168000,
                currency: "UAH",
                done: false,
              },
            ],
          },
          handoffPackageReady: false,
          productionOrderCreated: false,
          productionLaunched: false,
        },
      },
    });

    await prisma.dealContract.create({
      data: {
        dealId: d.id,
        status: "SENT_FOR_SIGNATURE",
        templateKey: "kitchen_v1",
        version: 1,
        diiaSessionId: "demo-session-placeholder",
        content: { variables: { customer: demoClient.name } },
      },
    });
  }

  const existing = await prisma.lead.count();
  if (existing === 0) {
    await prisma.lead.createMany({
      data: [
        {
          title: "Кухня · ЖК RIVER",
          source: "telegram",
          pipelineId: pipeline.id,
          stageId: stage("new"),
          priority: "high",
          contactName: "Олександр",
          phone: "+380501112233",
          email: "olex@example.com",
          ownerId: user.id,
        },
        {
          title: "Гардеробна · котедж",
          source: "instagram",
          pipelineId: pipeline.id,
          stageId: stage("working"),
          priority: "normal",
          contactName: "Дмитро",
          phone: "+380671112233",
          ownerId: user.id,
        },
        {
          title: "Офіс · IT компанія",
          source: "web",
          pipelineId: pipeline.id,
          stageId: stage("qualified"),
          priority: "high",
          contactName: "Studio Loft",
          email: "hello@loft.studio",
          ownerId: user.id,
        },
      ],
    });
  }

  await ensureMaterialCatalog(prisma);

  await ensureBankIntegrations(prisma);

  if (process.env.SEED_JOURNEYS !== "0") {
    const { seedJourneys } = await import("./seeds/journeys.seed.mjs");
    await seedJourneys(prisma, bcrypt);
  }

   
  console.log(
    "Seed OK. Адміністратор: admin@enver.com / admin123 (SUPER_ADMIN, усі права)",
  );
   
  console.log("Seed OK. Демо: demo@enver.local / demo123 (DIRECTOR, усі права)");
   
  console.log(
    "Seed OK. Головний менеджер: vera.blochytska@enver.local / vera123 (HEAD_MANAGER)",
  );
   
  console.log(
    "Seed OK. Workspace: slug=enver (користувачі admin, demo, vera — OWNER/ADMIN у WorkspaceMember).",
  );
   
  console.log(`Додайте в .env.local: DEMO_LEAD_OWNER_ID=${user.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
