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

const WORKSHOP_BASE_KEYS = [
  "DASHBOARD_VIEW",
  "DEALS_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "TASKS_VIEW",
  "TASKS_UPDATE",
  "PRODUCTION_ORDERS_VIEW",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

const CUTTING_KEYS = [...WORKSHOP_BASE_KEYS, "FILES_VIEW"];
const EDGING_KEYS = [...WORKSHOP_BASE_KEYS, "FILES_VIEW"];
const DRILLING_KEYS = [...WORKSHOP_BASE_KEYS, "FILES_VIEW"];
const ASSEMBLY_KEYS = [
  ...WORKSHOP_BASE_KEYS,
  "FILES_VIEW",
  "FILES_UPLOAD",
  "HANDOFF_ACCEPT",
];
const CONSTRUCTOR_KEYS = [
  "DASHBOARD_VIEW",
  "DEALS_VIEW",
  "DEAL_WORKSPACE_VIEW",
  "FILES_VIEW",
  "FILES_UPLOAD",
  "FILES_DELETE",
  "FILE_UPLOAD",
  "FILE_DELETE",
  "TASKS_VIEW",
  "TASKS_UPDATE",
  "PRODUCTION_ORDERS_VIEW",
  "PRODUCTION_ORCHESTRATION_VIEW",
  "PRODUCTION_ORCHESTRATION_MANAGE",
  "NOTIFICATIONS_VIEW",
  "AI_USE",
];

function getDefaultPermissionKeysForRole(role) {
  switch (role) {
    case "SUPER_ADMIN":
    case "DIRECTOR":
    case "DIRECTOR_PRODUCTION":
      return "ALL";
    case "HEAD_MANAGER":
    case "MANAGER":
    case "TEAM_LEAD":
      return PERMISSION_KEYS.filter((k) => !HEAD_MANAGER_EXCLUDED_KEYS.has(k));
    case "ADMIN":
      return PERMISSION_KEYS.filter((k) => k !== "ROLES_MANAGE");
    case "SALES_MANAGER":
    case "USER":
      return [
        "DASHBOARD_VIEW",
        "LEADS_VIEW",
        "LEADS_CREATE",
        "LEADS_UPDATE",
        "LEADS_ASSIGN",
        "CONTACTS_VIEW",
        "CALENDAR_VIEW",
        "TASKS_VIEW",
        "TASKS_CREATE",
        "TASKS_UPDATE",
        "TASKS_ASSIGN",
        "DEALS_VIEW",
        "DEALS_CREATE",
        "DEALS_UPDATE",
        "DEALS_ASSIGN",
        "DEALS_STAGE_CHANGE",
        "DEAL_WORKSPACE_VIEW",
        "NOTIFICATIONS_VIEW",
        "FILES_VIEW",
        "FILES_UPLOAD",
        "FILES_DELETE",
        "FILE_UPLOAD",
        "FILE_DELETE",
        "ESTIMATES_VIEW",
        "ESTIMATES_CREATE",
        "ESTIMATES_UPDATE",
        "QUOTES_CREATE",
        "CONTRACTS_VIEW",
        "CONTRACTS_CREATE",
        "CONTRACTS_UPDATE",
        "CONTRACT_VIEW",
        "CONTRACT_EDIT",
        "CONTRACT_SEND_SIGNATURE",
        "PAYMENTS_VIEW",
        "PAYMENTS_UPDATE",
        "PAYMENT_CONFIRM",
        "HANDOFF_SUBMIT",
        "READINESS_OVERRIDE_REQUEST",
        "PRODUCTION_LAUNCH",
        "REPORTS_VIEW",
        "ORDERS_VIEW",
        "PRODUCTS_VIEW",
        "AI_USE",
      ];
    case "MEASURER":
      return [
        "DASHBOARD_VIEW",
        "LEADS_VIEW",
        "CALENDAR_VIEW",
        "TASKS_VIEW",
        "NOTIFICATIONS_VIEW",
        "AI_USE",
      ];
    case "PRODUCTION_WORKER":
      return [
        "DASHBOARD_VIEW",
        "DEALS_VIEW",
        "DEAL_WORKSPACE_VIEW",
        "FILES_VIEW",
        "FILES_UPLOAD",
        "TASKS_VIEW",
        "TASKS_UPDATE",
        "PRODUCTION_ORDERS_VIEW",
        "PRODUCTION_ORCHESTRATION_VIEW",
        "NOTIFICATIONS_VIEW",
        "AI_USE",
      ];
    case "CUTTING":
      return CUTTING_KEYS;
    case "EDGING":
      return EDGING_KEYS;
    case "DRILLING":
      return DRILLING_KEYS;
    case "ASSEMBLY":
      return ASSEMBLY_KEYS;
    case "CONSTRUCTOR":
      return CONSTRUCTOR_KEYS;
    case "ACCOUNTANT":
      return [
        ...PERMISSION_KEYS.filter(
          (k) =>
            !HEAD_MANAGER_EXCLUDED_KEYS.has(k) &&
            k !== "LEADS_ASSIGN" &&
            k !== "DEALS_ASSIGN",
        ),
        "AI_USE",
      ];
    case "PROCUREMENT_MANAGER":
      return [
        ...PERMISSION_KEYS.filter(
          (k) =>
            !HEAD_MANAGER_EXCLUDED_KEYS.has(k) &&
            k !== "ROLES_MANAGE" &&
            k !== "USERS_MANAGE",
        ),
        "AI_USE",
        "AI_ANALYTICS",
      ];
    default:
      return [
        "DASHBOARD_VIEW",
        "LEADS_VIEW",
        "CONTACTS_VIEW",
        "TASKS_VIEW",
        "DEALS_VIEW",
        "NOTIFICATIONS_VIEW",
      ];
  }
}

async function grantPermissionsForRole(userId, role) {
  const mode = getDefaultPermissionKeysForRole(role);
  if (mode === "ALL") {
    await grantAllPermissions(userId);
    return;
  }

  for (const key of mode) {
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

async function ensureConstructorHubSeed(prisma, { ownerId }) {
  const deal = await prisma.deal.findFirst({
    where: { ownerId },
    include: {
      productionFlow: true,
      constructorWorkspace: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (!deal?.productionFlow) return;

  const workspace =
    deal.constructorWorkspace ??
    (await prisma.constructorWorkspace.create({
      data: {
        dealId: deal.id,
        productionFlowId: deal.productionFlow.id,
        assignedByUserId: ownerId,
        assignedConstructorUserId: ownerId,
        status: "UNDER_REVIEW",
        priority: "HIGH",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }));

  await prisma.constructorTechSpec.upsert({
    where: { workspaceId: workspace.id },
    update: {
      generalInfoJson: { projectType: "kitchen+wardrobe+dressing" },
      zonesJson: [{ key: "kitchen", progress: 100 }, { key: "wardrobe", progress: 60 }, { key: "dressing", progress: 20 }],
      materialsJson: { approved: ["Egger W1000", "ABS 1mm"] },
      approvedDataSnapshotJson: { quoteVersion: "V3", measurementsApproved: true },
      updatedByUserId: ownerId,
    },
    create: {
      workspaceId: workspace.id,
      generalInfoJson: { projectType: "kitchen+wardrobe+dressing" },
      zonesJson: [{ key: "kitchen", progress: 100 }, { key: "wardrobe", progress: 60 }, { key: "dressing", progress: 20 }],
      materialsJson: { approved: ["Egger W1000", "ABS 1mm"] },
      approvedDataSnapshotJson: { quoteVersion: "V3", measurementsApproved: true },
      createdByUserId: ownerId,
      updatedByUserId: ownerId,
    },
  });

  const existingQuestions = await prisma.constructorQuestion.count({
    where: { workspaceId: workspace.id },
  });
  if (existingQuestions === 0) {
    await prisma.constructorQuestion.createMany({
      data: [
        {
          workspaceId: workspace.id,
          createdByUserId: ownerId,
          category: "MATERIALS",
          priority: "MEDIUM",
          status: "CLOSED",
          title: "Подтвердите декор корпуса",
          description: "Утвердите финальный декор Egger W1000",
          answerText: "Подтверждено",
          answeredByUserId: ownerId,
          answeredAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
          closedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          workspaceId: workspace.id,
          createdByUserId: ownerId,
          category: "FITTINGS",
          priority: "HIGH",
          status: "CLOSED",
          title: "Список фурнитуры финальный?",
          description: "Петли/направляющие согласованы?",
          answerText: "Да, список финальный",
          answeredByUserId: ownerId,
          answeredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
          closedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        },
        {
          workspaceId: workspace.id,
          createdByUserId: ownerId,
          category: "DIMENSIONS",
          priority: "CRITICAL",
          status: "OPEN",
          title: "Ниша 2600 или 2580 мм?",
          description: "Критический вопрос по нише холодильника",
          isCritical: true,
          isPinned: true,
        },
      ],
    });
  }

  const existingVersions = await prisma.constructorVersion.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { versionNumber: "asc" },
  });
  if (existingVersions.length === 0) {
    const v1 = await prisma.constructorVersion.create({
      data: {
        workspaceId: workspace.id,
        versionNumber: 1,
        versionCode: "V1",
        type: "DRAFT",
        status: "CHANGES_REQUESTED",
        summary: "Первый черновик, возвращен на доработку.",
        isCurrent: false,
        submittedByUserId: ownerId,
        submittedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
      },
    });
    const v2 = await prisma.constructorVersion.create({
      data: {
        workspaceId: workspace.id,
        versionNumber: 2,
        versionCode: "V2",
        type: "REVIEW",
        status: "UNDER_REVIEW",
        summary: "Уточнены размеры, обновлены чертежи и спецификация.",
        isCurrent: true,
        submittedByUserId: ownerId,
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });
    await prisma.constructorReview.create({
      data: {
        workspaceId: workspace.id,
        versionId: v1.id,
        reviewedByUserId: ownerId,
        decision: "RETURN_FOR_REVISION",
        comment: "Нужно уточнить нишу и добавить список фурнитуры.",
        severity: "MAJOR",
        checklistJson: { dimensionsVerified: false, materialsVerified: true },
        remarksJson: ["Уточнить нишу", "Добавить фурнитуру"],
      },
    });
    await prisma.constructorFile.createMany({
      data: [
        {
          workspaceId: workspace.id,
          versionId: v1.id,
          uploadedByUserId: ownerId,
          fileUrl: "https://example.com/draft-v1.pdf",
          originalName: "draft-v1.pdf",
          mimeType: "application/pdf",
          extension: "pdf",
          fileCategory: "CONSTRUCTOR_DRAFT",
          versionLabel: "V1",
          isCurrent: false,
          isArchived: true,
        },
        {
          workspaceId: workspace.id,
          versionId: v2.id,
          uploadedByUserId: ownerId,
          fileUrl: "https://example.com/review-v2.pdf",
          originalName: "review-v2.pdf",
          mimeType: "application/pdf",
          extension: "pdf",
          fileCategory: "DRAWING",
          versionLabel: "V2",
          isCurrent: true,
          isImportant: true,
        },
      ],
    });
    await prisma.constructorAIInsight.createMany({
      data: [
        {
          workspaceId: workspace.id,
          versionId: v2.id,
          type: "MISMATCH",
          severity: "HIGH",
          title: "Несоответствие замера",
          description: "Ниша 2600 мм вместо 2580 мм",
        },
        {
          workspaceId: workspace.id,
          versionId: v2.id,
          type: "MISSING_DATA",
          severity: "MEDIUM",
          title: "Нет списка фурнитуры",
          description: "Отсутствует финальный fittings list",
        },
      ],
    });
  }

  console.log("Seed: Constructor Hub demo workspace готов.");
}

async function ensureConstructorStageDemoOrders(prisma, { ownerId, dealPipelineId, dealStageId }) {
  const now = Date.now();
  const rows = [
    {
      dealId: "seed_deal_constructor_test",
      title: "тест",
      description: "Демо-замовлення для етапу конструкторів",
      clientId: "seed_client_constructor_test",
      clientName: "Клієнт Тест",
      contactId: "seed_contact_constructor_test",
      contactName: "Контакт Тест",
      contactEmail: "constructor.test@enver.local",
      contactPhone: "+380671000001",
      flowNumber: "PF-DEMO-CONSTRUCTOR-TEST",
      roomToken: "seed-constructor-test",
      externalConstructorLabel: "Демо конструктор #1",
      dueInDays: 2,
      priority: "HIGH",
    },
    {
      dealId: "seed_deal_constructor_test2",
      title: "тест2",
      description: "Демо-замовлення для етапу конструкторів",
      clientId: "seed_client_constructor_test2",
      clientName: "Клієнт Тест 2",
      contactId: "seed_contact_constructor_test2",
      contactName: "Контакт Тест 2",
      contactEmail: "constructor.test2@enver.local",
      contactPhone: "+380671000002",
      flowNumber: "PF-DEMO-CONSTRUCTOR-TEST2",
      roomToken: "seed-constructor-test2",
      externalConstructorLabel: "Демо конструктор #2",
      dueInDays: 3,
      priority: "NORMAL",
    },
  ];

  for (const row of rows) {
    await prisma.client.upsert({
      where: { id: row.clientId },
      update: { name: row.clientName },
      create: {
        id: row.clientId,
        name: row.clientName,
        type: "PERSON",
      },
    });

    await prisma.contact.upsert({
      where: { id: row.contactId },
      update: {
        fullName: row.contactName,
        email: row.contactEmail,
        phone: row.contactPhone,
        clientId: row.clientId,
      },
      create: {
        id: row.contactId,
        fullName: row.contactName,
        email: row.contactEmail,
        phone: row.contactPhone,
        clientId: row.clientId,
      },
    });

    await prisma.deal.upsert({
      where: { id: row.dealId },
      update: {
        title: row.title,
        description: row.description,
        status: "OPEN",
        pipelineId: dealPipelineId,
        stageId: dealStageId,
        clientId: row.clientId,
        primaryContactId: row.contactId,
        ownerId,
        value: 120000,
        currency: "UAH",
      },
      create: {
        id: row.dealId,
        title: row.title,
        description: row.description,
        status: "OPEN",
        pipelineId: dealPipelineId,
        stageId: dealStageId,
        clientId: row.clientId,
        primaryContactId: row.contactId,
        ownerId,
        value: 120000,
        currency: "UAH",
      },
    });

    await prisma.dealHandoff.upsert({
      where: { dealId: row.dealId },
      update: {
        status: "ACCEPTED",
        acceptedAt: new Date(now - 24 * 60 * 60 * 1000),
        submittedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
        rejectedAt: null,
        rejectionReason: null,
      },
      create: {
        dealId: row.dealId,
        status: "ACCEPTED",
        acceptedAt: new Date(now - 24 * 60 * 60 * 1000),
        submittedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.productionFlow.upsert({
      where: { dealId: row.dealId },
      update: {
        number: row.flowNumber,
        title: row.title,
        clientName: row.clientName,
        status: "ACTIVE",
        currentStepKey: "CONSTRUCTOR_IN_PROGRESS",
        priority: row.priority,
        readinessPercent: 45,
        dueDate: new Date(now + row.dueInDays * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(now - 24 * 60 * 60 * 1000),
      },
      create: {
        number: row.flowNumber,
        dealId: row.dealId,
        title: row.title,
        clientName: row.clientName,
        status: "ACTIVE",
        currentStepKey: "CONSTRUCTOR_IN_PROGRESS",
        priority: row.priority,
        readinessPercent: 45,
        dueDate: new Date(now + row.dueInDays * 24 * 60 * 60 * 1000),
        acceptedAt: new Date(now - 24 * 60 * 60 * 1000),
      },
    });

    await prisma.dealConstructorRoom.upsert({
      where: { dealId: row.dealId },
      update: {
        status: "IN_PROGRESS",
        priority: row.priority,
        dueAt: new Date(now + row.dueInDays * 24 * 60 * 60 * 1000),
        publicToken: row.roomToken,
        assignedById: ownerId,
        assignedUserId: ownerId,
        externalConstructorLabel: row.externalConstructorLabel,
      },
      create: {
        dealId: row.dealId,
        status: "IN_PROGRESS",
        priority: row.priority,
        dueAt: new Date(now + row.dueInDays * 24 * 60 * 60 * 1000),
        publicToken: row.roomToken,
        assignedById: ownerId,
        assignedUserId: ownerId,
        externalConstructorLabel: row.externalConstructorLabel,
      },
    });
  }

  console.log("Seed: додано 2 демо-замовлення (тест, тест2) на етап конструкторів.");
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

  await grantPermissionsForRole(admin.id, "SUPER_ADMIN");
  await grantPermissionsForRole(user.id, "DIRECTOR");

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
  await grantPermissionsForRole(vera.id, "HEAD_MANAGER");

  const groupUsers = [
    {
      email: "sales.manager@enver.local",
      name: "Менеджер з продажу",
      role: "SALES_MANAGER",
      password: "sales123",
    },
    {
      email: "head.manager@enver.local",
      name: "Головний менеджер",
      role: "HEAD_MANAGER",
      password: "head12345",
    },
    {
      email: "director@enver.local",
      name: "Директор",
      role: "DIRECTOR",
      password: "director123",
    },
    {
      email: "production.chief@enver.local",
      name: "Начальник виробництва",
      role: "DIRECTOR_PRODUCTION",
      password: "chief12345",
    },
    {
      email: "cutting@enver.local",
      name: "Порізка",
      role: "CUTTING",
      password: "cutting123",
    },
    {
      email: "edging@enver.local",
      name: "Крайкування",
      role: "EDGING",
      password: "edging123",
    },
    {
      email: "drilling@enver.local",
      name: "Присадка",
      role: "DRILLING",
      password: "drilling123",
    },
    {
      email: "assembly@enver.local",
      name: "Збірка",
      role: "ASSEMBLY",
      password: "assembly123",
    },
    {
      email: "constructor@enver.local",
      name: "Конструктор",
      role: "CONSTRUCTOR",
      password: "constructor123",
    },
    {
      email: "procurement@enver.local",
      name: "Закупівля",
      role: "PROCUREMENT_MANAGER",
      password: "procure123",
    },
    {
      email: "accountant@enver.local",
      name: "Бухгалтер",
      role: "ACCOUNTANT",
      password: "account123",
    },
  ];

  for (const item of groupUsers) {
    const passwordHash = await bcrypt.hash(item.password, 10);
    const created = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        name: item.name,
        passwordHash,
        role: item.role,
      },
      create: {
        email: item.email,
        name: item.name,
        passwordHash,
        role: item.role,
      },
    });
    await grantPermissionsForRole(created.id, item.role);
  }

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

  await ensureConstructorHubSeed(prisma, { ownerId: user.id });
  await ensureConstructorStageDemoOrders(prisma, {
    ownerId: user.id,
    dealPipelineId: dealPipeline.id,
    dealStageId: dealStage("production"),
  });

   
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
