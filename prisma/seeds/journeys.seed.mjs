/**
 * Сиди з пакету cursor_addon_seeds_journeys_tests.md:
 * користувачі, матеріали Viyar, ліди в різних станах, смети, КП, угоди, активності.
 * Ідемпотентно: повторний запуск оновлює ті самі id.
 */

import { randomBytes } from "node:crypto";

/** Підрахунок totalPrice як у recalculateEstimateTotals (без окремого import TS). */
function estimateTotalFromLines(
  lineItems,
  discountAmount,
  deliveryCost,
  installationCost,
) {
  const sumSale = lineItems.reduce((a, l) => a + l.amountSale, 0);
  const disc = discountAmount ?? 0;
  const del = deliveryCost ?? 0;
  const inst = installationCost ?? 0;
  return sumSale - disc + del + inst;
}

function snapshotJsonFromEstimate(e, lineItems) {
  return {
    schema: "lead_proposal_snapshot_v1",
    capturedAt: new Date().toISOString(),
    estimateId: e.id,
    estimateVersion: e.version,
    currency: "UAH",
    total: e.totalPrice,
    discountAmount: e.discountAmount,
    deliveryCost: e.deliveryCost,
    installationCost: e.installationCost,
    notes: e.notes,
    lineItems: lineItems.map((li) => ({
      id: li.id,
      type: li.type,
      category: li.category,
      productName: li.productName,
      qty: li.qty,
      unit: li.unit,
      salePrice: li.salePrice,
      amountSale: li.amountSale,
    })),
  };
}

async function ensureLeadPipelineStages(prisma, pipelineId) {
  const extra = [
    { slug: "estimating", name: "Прорахунок", sortOrder: 15 },
    { slug: "proposal_sent", name: "КП надіслано", sortOrder: 25 },
    { slug: "negotiating", name: "Переговори", sortOrder: 35 },
    { slug: "ready_convert", name: "Готовий до конверсії", sortOrder: 45 },
  ];
  const existing = await prisma.pipelineStage.findMany({
    where: { pipelineId },
    select: { slug: true, sortOrder: true },
  });
  const slugs = new Set(existing.map((s) => s.slug));
  let maxOrder = Math.max(0, ...existing.map((s) => s.sortOrder));
  for (const s of extra) {
    if (slugs.has(s.slug)) continue;
    maxOrder += 1;
    await prisma.pipelineStage.create({
      data: {
        pipelineId,
        name: s.name,
        slug: s.slug,
        sortOrder: maxOrder,
        isFinal: false,
      },
    });
  }
}

async function upsertJourneyUsers(prisma, bcrypt) {
  const hash = await bcrypt.hash("journey123", 10);
  const users = [
    {
      id: "usr_head_sales",
      email: "olena@crm.local",
      name: "Олена Коваль",
      role: "HEAD_MANAGER",
    },
    {
      id: "usr_sales_1",
      email: "iryna@crm.local",
      name: "Ірина Мельник",
      role: "SALES_MANAGER",
    },
    {
      id: "usr_sales_2",
      email: "andrii@crm.local",
      name: "Андрій Бойко",
      role: "SALES_MANAGER",
    },
    {
      id: "usr_production_1",
      email: "taras@crm.local",
      name: "Тарас Литвин",
      role: "SALES_MANAGER",
    },
  ];
  const out = {};
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash: hash },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: hash,
      },
    });
    out[u.id] = row;
  }
  return out;
}

async function grantAllPermissionsToUser(prisma, userId) {
  const perms = await prisma.permission.findMany();
  for (const p of perms) {
    await prisma.permissionOnUser.upsert({
      where: {
        userId_permissionId: { userId, permissionId: p.id },
      },
      update: {},
      create: { userId, permissionId: p.id },
    });
  }
}

/** Додаткові позиції з addon (доповнює ensureMaterialCatalog у seed.mjs). */
async function ensureAddonMaterialRows(prisma) {
  const viyar = await prisma.materialProvider.findUnique({
    where: { key: "viyar" },
  });
  if (!viyar) return;
  const rows = [
    {
      externalId: "viyar-egger-white-18",
      category: "Фасади",
      brand: "Egger",
      name: "Egger Білий 18мм",
      displayName: "Egger білий 18мм",
      unit: "м²",
      price: 1450,
    },
    {
      externalId: "viyar-mdf-painted-basic",
      category: "Фарбований МДФ",
      brand: "МДФ",
      name: "МДФ фарбований базовий",
      displayName: "МДФ фарбований базовий",
      unit: "м²",
      price: 2200,
    },
    {
      externalId: "viyar-blum-hinges",
      category: "Фурнітура",
      brand: "Blum",
      name: "Blum фурнітура комплект",
      displayName: "Blum комплект",
      unit: "компл",
      price: 7800,
    },
    {
      externalId: "viyar-countertop-basic",
      category: "Стільниця",
      brand: "Egger",
      name: "Стільниця Egger базова",
      displayName: "Стільниця базова",
      unit: "пог. м",
      price: 3200,
    },
    {
      externalId: "viyar-wardrobe-system-basic",
      category: "Корпус",
      brand: "Корпус",
      name: "Корпус шафи базовий",
      displayName: "Модуль шафи",
      unit: "компл",
      price: 18000,
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
        currency: "UAH",
        syncedAt: new Date(),
      },
    });
  }
}

function lineProduct(
  id,
  category,
  productName,
  qty,
  unit,
  salePrice,
  costPrice,
) {
  const amountSale = qty * salePrice;
  const amountCost = costPrice != null ? qty * costPrice : null;
  return {
    id,
    type: "PRODUCT",
    category,
    productName,
    qty,
    unit,
    salePrice,
    costPrice: costPrice ?? null,
    amountSale,
    amountCost,
    margin:
      amountCost != null ? amountSale - amountCost : null,
  };
}

export async function seedJourneys(prisma, bcrypt) {
  const pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "LEAD", isDefault: true },
    include: { stages: true },
  });
  const dealPipeline = await prisma.pipeline.findFirst({
    where: { entityType: "DEAL", isDefault: true },
    include: { stages: true },
  });
  if (!pipeline || !dealPipeline) {
     
    console.warn(
      "[journeys.seed] Пропущено: немає дефолтних воронок LEAD/DEAL.",
    );
    return;
  }

  await ensureLeadPipelineStages(prisma, pipeline.id);
  const stages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pipeline.id },
  });
  const st = (slug) => {
    const s = stages.find((x) => x.slug === slug);
    if (!s) throw new Error(`Lead stage ${slug} not found`);
    return s.id;
  };

  const dealStage = (slug) => {
    const s = dealPipeline.stages.find((x) => x.slug === slug);
    if (!s) throw new Error(`Deal stage ${slug} not found`);
    return s.id;
  };

  const users = await upsertJourneyUsers(prisma, bcrypt);
  for (const uid of Object.keys(users)) {
    await grantAllPermissionsToUser(prisma, uid);
  }
  await ensureAddonMaterialRows(prisma);

  const olena = users.usr_head_sales;
  const iryna = users.usr_sales_1;
  const andrii = users.usr_sales_2;
  const taras = users.usr_production_1;

  const now = Date.now();
  const day = 86400000;
  const future1 = new Date(now + day);
  const yesterday = new Date(now - day);
  const threeDaysAgo = new Date(now - 3 * day);
  const fourDaysAgo = new Date(now - 4 * day);

  /** Контакти */
  const contacts = [
    {
      id: "contact_journey_maria",
      fullName: "Марія Іваненко",
      phone: "+380671112233",
      email: "maria@example.com",
      telegramHandle: "mariaiv",
    },
    {
      id: "contact_journey_petrenko",
      fullName: "Олена Петренко",
      phone: "+380671122334",
      email: "helen.p@example.com",
    },
    {
      id: "contact_journey_shevchenko",
      fullName: "Ігор Шевченко",
      phone: "+380501112200",
      email: "igor.s@example.com",
    },
    {
      id: "contact_journey_bondar",
      fullName: "Світлана Бондар",
      phone: "+380631112233",
      email: "svit@example.com",
    },
    {
      id: "contact_journey_savchenko",
      fullName: "Оксана Савченко",
      phone: "+380501113344",
      email: "oksana@example.com",
    },
    {
      id: "contact_journey_hnatyuk",
      fullName: "Роман Гнатюк",
      phone: "+380671334455",
      email: "roman@example.com",
    },
    {
      id: "contact_journey_diachenko",
      fullName: "Наталія Дяченко",
      phone: "+380501445566",
      email: "natalia@example.com",
    },
    {
      id: "contact_journey_melnyk",
      fullName: "Віктор Мельник",
      phone: "+380671556677",
      email: "viktor@example.com",
    },
  ];

  for (const c of contacts) {
    await prisma.contact.upsert({
      where: { id: c.id },
      update: {
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        telegramHandle: c.telegramHandle ?? null,
      },
      create: {
        id: c.id,
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        telegramHandle: c.telegramHandle ?? null,
      },
    });
  }

  const qual = (b) => ({
    furnitureType: b.furnitureType,
    objectType: b.objectType,
    budgetRange: b.budgetRange,
    temperature: b.temperature,
    timeline: b.timeline ?? null,
  });

  /** --- Lead A: новий --- */
  await prisma.lead.upsert({
    where: { id: "lead_journey_new" },
    update: {},
    create: {
      id: "lead_journey_new",
      title: "Кухня — ЖК Варшавський / Іваненко",
      source: "instagram",
      pipelineId: pipeline.id,
      stageId: st("new"),
      priority: "high",
      contactName: "Марія Іваненко",
      phone: "+380671112233",
      email: "maria@example.com",
      contactId: "contact_journey_maria",
      ownerId: iryna.id,
      createdById: olena.id,
      qualification: qual({
        furnitureType: "kitchen",
        objectType: "apartment",
        budgetRange: "",
        temperature: "warm",
      }),
      lastActivityAt: null,
      hubMeta: {
        aiInsights: [
          {
            id: "nba-1",
            title: "Звʼяжіться з клієнтом",
            content: "Новий лід без активності — перший контакт.",
          },
        ],
      },
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_new",
        contactId: "contact_journey_maria",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_new",
      contactId: "contact_journey_maria",
      isPrimary: true,
      role: "PRIMARY",
    },
  });
  await prisma.leadMessage.upsert({
    where: { id: "lm_journey_new_inbound" },
    update: {},
    create: {
      id: "lm_journey_new_inbound",
      leadId: "lead_journey_new",
      body: "Доброго дня! Цікавить кухня близько 3м, фасади МДФ. Можна орієнтир по ціні?",
      channel: "INTERNAL",
      interactionKind: "MESSAGE",
      contactId: "contact_journey_maria",
      createdById: iryna.id,
      occurredAt: new Date(now - 2 * 3600000),
    },
  });

  /** --- Lead B: кваліфікація --- */
  await prisma.lead.upsert({
    where: { id: "lead_journey_qual" },
    update: {},
    create: {
      id: "lead_journey_qual",
      title: "Шафа-купе — Софіївська Борщагівка / Петренко",
      source: "referral",
      pipelineId: pipeline.id,
      stageId: st("qualified"),
      priority: "normal",
      contactName: "Олена Петренко",
      phone: "+380671122334",
      contactId: "contact_journey_petrenko",
      ownerId: andrii.id,
      createdById: olena.id,
      nextStep: "Уточнити розміри та викликати на замір",
      nextContactAt: future1,
      lastActivityAt: new Date(now - day),
      qualification: qual({
        furnitureType: "wardrobe",
        objectType: "apartment",
        budgetRange: "35000–50000 UAH",
        temperature: "warm",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_qual",
        contactId: "contact_journey_petrenko",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_qual",
      contactId: "contact_journey_petrenko",
      isPrimary: true,
      role: "PRIMARY",
    },
  });

  /** --- Lead C: замір + календар --- */
  await prisma.lead.upsert({
    where: { id: "lead_journey_meas" },
    update: {},
    create: {
      id: "lead_journey_meas",
      title: "Гардеробна — ЖК Комфорт Таун / Шевченко",
      source: "website",
      pipelineId: pipeline.id,
      stageId: st("estimating"),
      priority: "high",
      contactName: "Ігор Шевченко",
      phone: "+380501112200",
      contactId: "contact_journey_shevchenko",
      ownerId: iryna.id,
      createdById: olena.id,
      nextStep: "Оновити прорахунок після заміру",
      nextContactAt: new Date(now),
      lastActivityAt: new Date(now - 12 * 3600000),
      qualification: qual({
        furnitureType: "wardrobe",
        objectType: "apartment",
        budgetRange: "70000–110000 UAH",
        temperature: "hot",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_meas",
        contactId: "contact_journey_shevchenko",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_meas",
      contactId: "contact_journey_shevchenko",
      isPrimary: true,
      role: "PRIMARY",
    },
  });
  await prisma.calendarEvent.upsert({
    where: { id: "cal_journey_meas_done" },
    update: {},
    create: {
      id: "cal_journey_meas_done",
      leadId: "lead_journey_meas",
      title: "Замір гардеробної",
      description: "Заміри зняті, креслення додано.",
      type: "MEASUREMENT",
      status: "COMPLETED",
      startAt: new Date(now - day),
      endAt: new Date(now - day + 3600000),
      createdById: iryna.id,
    },
  });

  /** --- Lead D: смета без КП --- */
  const linesD = [
    lineProduct(
      "el-d-1",
      "Корпус",
      "Корпус кухні",
      1,
      "компл",
      65000,
      40000,
    ),
    lineProduct(
      "el-d-2",
      "Фасади",
      "МДФ фарбований",
      1,
      "компл",
      32000,
      22000,
    ),
    lineProduct(
      "el-d-3",
      "Стільниця",
      "Стільниця Egger",
      3,
      "пог. м",
      3200,
      2000,
    ),
    lineProduct("el-d-4", "Фурнітура", "Blum комплект", 1, "компл", 15000, 7800),
    lineProduct("el-d-5", "Доставка", "Доставка", 1, "посл", 3500, null),
    lineProduct("el-d-6", "Монтаж", "Монтаж", 1, "посл", 12900, null),
  ];
  const discD = 8000;
  const totalD = estimateTotalFromLines(linesD, discD, 0, 0);

  await prisma.lead.upsert({
    where: { id: "lead_journey_est_only" },
    update: {},
    create: {
      id: "lead_journey_est_only",
      title: "Кухня — Ірпінь / Бондар",
      source: "instagram",
      pipelineId: pipeline.id,
      stageId: st("estimating"),
      priority: "high",
      contactName: "Світлана Бондар",
      phone: "+380631112233",
      contactId: "contact_journey_bondar",
      ownerId: iryna.id,
      createdById: olena.id,
      nextStep: "Підготувати КП",
      nextContactAt: new Date(now),
      qualification: qual({
        furnitureType: "kitchen",
        objectType: "house",
        budgetRange: "120000–180000 UAH",
        temperature: "hot",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_est_only",
        contactId: "contact_journey_bondar",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_est_only",
      contactId: "contact_journey_bondar",
      isPrimary: true,
      role: "PRIMARY",
    },
  });

  const estD = await prisma.estimate.upsert({
    where: { id: "est_journey_d_v1" },
    update: {
      totalPrice: totalD,
      grossMargin: totalD - linesD.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      discountAmount: discD,
    },
    create: {
      id: "est_journey_d_v1",
      leadId: "lead_journey_est_only",
      dealId: null,
      version: 1,
      status: "DRAFT",
      totalPrice: totalD,
      totalCost: linesD.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      grossMargin:
        totalD - linesD.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      discountAmount: discD,
      deliveryCost: 0,
      installationCost: 0,
      notes: "Базова комплектація з доставкою та монтажем",
      templateKey: "kitchen",
      createdById: iryna.id,
      isActive: true,
      isClientFacing: true,
    },
  });
  await prisma.estimateLineItem.deleteMany({ where: { estimateId: estD.id } });
  for (const li of linesD) {
    await prisma.estimateLineItem.create({
      data: {
        estimateId: estD.id,
        type: li.type,
        category: li.category,
        productName: li.productName,
        qty: li.qty,
        unit: li.unit,
        salePrice: li.salePrice,
        costPrice: li.costPrice,
        amountSale: li.amountSale,
        amountCost: li.amountCost,
        margin: li.margin,
      },
    });
  }
  await prisma.lead.update({
    where: { id: "lead_journey_est_only" },
    data: { activeEstimateId: estD.id },
  });

  /** --- Lead E: КП надіслано --- */
  const linesE = linesD.map((l) => ({
    ...l,
    id: l.id.replace("el-d", "el-e"),
  }));
  const totalE = estimateTotalFromLines(linesE, discD, 0, 0);
  await prisma.lead.upsert({
    where: { id: "lead_journey_prop_sent" },
    update: {},
    create: {
      id: "lead_journey_prop_sent",
      title: "Кухня — Буча / Савченко",
      source: "showroom",
      pipelineId: pipeline.id,
      stageId: st("proposal_sent"),
      priority: "high",
      contactName: "Оксана Савченко",
      phone: "+380501113344",
      contactId: "contact_journey_savchenko",
      ownerId: andrii.id,
      createdById: olena.id,
      nextStep: "Follow-up після КП",
      nextContactAt: yesterday,
      lastActivityAt: threeDaysAgo,
      qualification: qual({
        furnitureType: "kitchen",
        objectType: "apartment",
        budgetRange: "140000–200000 UAH",
        temperature: "hot",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_prop_sent",
        contactId: "contact_journey_savchenko",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_prop_sent",
      contactId: "contact_journey_savchenko",
      isPrimary: true,
      role: "PRIMARY",
    },
  });
  const estE = await prisma.estimate.upsert({
    where: { id: "est_journey_e_v2" },
    update: { totalPrice: totalE },
    create: {
      id: "est_journey_e_v2",
      leadId: "lead_journey_prop_sent",
      version: 2,
      status: "SENT",
      totalPrice: totalE,
      totalCost: linesE.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      grossMargin:
        totalE - linesE.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      discountAmount: discD,
      createdById: andrii.id,
      isActive: true,
      isClientFacing: true,
    },
  });
  await prisma.estimateLineItem.deleteMany({ where: { estimateId: estE.id } });
  for (const li of linesE) {
    await prisma.estimateLineItem.create({
      data: {
        estimateId: estE.id,
        type: li.type,
        category: li.category,
        productName: li.productName,
        qty: li.qty,
        unit: li.unit,
        salePrice: li.salePrice,
        costPrice: li.costPrice,
        amountSale: li.amountSale,
        amountCost: li.amountCost,
        margin: li.margin,
      },
    });
  }
  const snapE = snapshotJsonFromEstimate(
    {
      id: estE.id,
      version: 2,
      totalPrice: totalE,
      discountAmount: discD,
      deliveryCost: 0,
      installationCost: 0,
      notes: null,
    },
    linesE,
  );
  const publicTokenE = randomBytes(16).toString("base64url").replace(/=/g, "");
  const propE = await prisma.leadProposal.upsert({
    where: { id: "prop_journey_e_v1" },
    update: {},
    create: {
      id: "prop_journey_e_v1",
      leadId: "lead_journey_prop_sent",
      estimateId: estE.id,
      version: 1,
      status: "SENT",
      sentAt: threeDaysAgo,
      viewedAt: null,
      title: "КП v1",
      snapshotJson: snapE,
      publicToken: publicTokenE,
      createdById: andrii.id,
    },
  });
  await prisma.lead.update({
    where: { id: "lead_journey_prop_sent" },
    data: {
      activeEstimateId: estE.id,
      activeProposalId: propE.id,
    },
  });

  /** --- Lead F: переговори --- */
  await prisma.lead.upsert({
    where: { id: "lead_journey_negotiate" },
    update: {},
    create: {
      id: "lead_journey_negotiate",
      title: "Шафа — Нові Петрівці / Гнатюк",
      source: "instagram",
      pipelineId: pipeline.id,
      stageId: st("negotiating"),
      priority: "normal",
      contactName: "Роман Гнатюк",
      phone: "+380671334455",
      contactId: "contact_journey_hnatyuk",
      ownerId: andrii.id,
      createdById: olena.id,
      nextStep: "Оновити прорахунок після зміни фасадів",
      nextContactAt: new Date(now),
      qualification: qual({
        furnitureType: "wardrobe",
        objectType: "house",
        budgetRange: "60000–90000 UAH",
        temperature: "hot",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_negotiate",
        contactId: "contact_journey_hnatyuk",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_negotiate",
      contactId: "contact_journey_hnatyuk",
      isPrimary: true,
      role: "PRIMARY",
    },
  });
  const linesF1 = [
    lineProduct("el-f1-1", "Корпус", "Корпус шафи", 1, "компл", 40000, 25000),
  ];
  const totalF1 = estimateTotalFromLines(linesF1, 0, 0, 0);
  const estF1 = await prisma.estimate.upsert({
    where: { id: "est_journey_f_v1" },
    update: {},
    create: {
      id: "est_journey_f_v1",
      leadId: "lead_journey_negotiate",
      version: 1,
      status: "SUPERSEDED",
      totalPrice: totalF1,
      totalCost: 25000,
      grossMargin: totalF1 - 25000,
      createdById: andrii.id,
      isActive: false,
      notes: "Перша версія",
    },
  });
  await prisma.estimateLineItem.deleteMany({ where: { estimateId: estF1.id } });
  await prisma.estimateLineItem.create({
    data: {
      estimateId: estF1.id,
      type: "PRODUCT",
      category: "Корпус",
      productName: "Корпус шафи",
      qty: 1,
      unit: "компл",
      salePrice: 40000,
      costPrice: 25000,
      amountSale: 40000,
      amountCost: 25000,
      margin: 15000,
    },
  });
  const linesF2 = [
    lineProduct("el-f2-1", "Корпус", "Корпус шафи", 1, "компл", 40000, 25000),
    lineProduct(
      "el-f2-2",
      "Фасади",
      "Фасади преміум",
      1,
      "компл",
      28000,
      18000,
    ),
    lineProduct("el-f2-3", "Підсвітка", "LED стрічка", 1, "компл", 4500, 2000),
  ];
  const totalF2 = estimateTotalFromLines(linesF2, 0, 0, 0);
  const estF2 = await prisma.estimate.upsert({
    where: { id: "est_journey_f_v2" },
    update: {
      notes: "Змінили фасади на дорожчий варіант, додали підсвітку",
    },
    create: {
      id: "est_journey_f_v2",
      leadId: "lead_journey_negotiate",
      version: 2,
      status: "DRAFT",
      totalPrice: totalF2,
      totalCost: 45000,
      grossMargin: totalF2 - 45000,
      createdById: andrii.id,
      isActive: true,
      notes: "Змінили фасади на дорожчий варіант, додали підсвітку",
    },
  });
  await prisma.estimateLineItem.deleteMany({ where: { estimateId: estF2.id } });
  for (const li of linesF2) {
    await prisma.estimateLineItem.create({
      data: {
        estimateId: estF2.id,
        type: li.type,
        category: li.category,
        productName: li.productName,
        qty: li.qty,
        unit: li.unit,
        salePrice: li.salePrice,
        costPrice: li.costPrice,
        amountSale: li.amountSale,
        amountCost: li.amountCost,
        margin: li.margin,
      },
    });
  }
  const snapF1 = snapshotJsonFromEstimate(
    {
      id: estF1.id,
      version: 1,
      totalPrice: totalF1,
      discountAmount: null,
      deliveryCost: null,
      installationCost: null,
      notes: null,
    },
    linesF1,
  );
  const propF1 = await prisma.leadProposal.upsert({
    where: { id: "prop_journey_f_v1" },
    update: {},
    create: {
      id: "prop_journey_f_v1",
      leadId: "lead_journey_negotiate",
      estimateId: estF1.id,
      version: 1,
      status: "CLIENT_REVIEWING",
      sentAt: new Date(now - 5 * day),
      viewedAt: new Date(now - 4 * day),
      title: "КП v1",
      snapshotJson: snapF1,
      publicToken: randomBytes(16).toString("base64url").replace(/=/g, ""),
      createdById: andrii.id,
    },
  });
  await prisma.lead.update({
    where: { id: "lead_journey_negotiate" },
    data: {
      activeEstimateId: estF2.id,
      activeProposalId: propF1.id,
    },
  });

  /** --- Lead G: готовий до конверсії --- */
  const linesG = linesD.map((l) => ({
    ...l,
    id: l.id.replace("el-d", "el-g"),
  }));
  const totalG = estimateTotalFromLines(linesG, discD, 0, 0);
  await prisma.lead.upsert({
    where: { id: "lead_journey_ready" },
    update: {},
    create: {
      id: "lead_journey_ready",
      title: "Кухня — Вишневе / Дяченко",
      source: "referral",
      pipelineId: pipeline.id,
      stageId: st("ready_convert"),
      priority: "high",
      contactName: "Наталія Дяченко",
      phone: "+380501445566",
      contactId: "contact_journey_diachenko",
      ownerId: iryna.id,
      createdById: olena.id,
      nextStep: "Створити угоду",
      nextContactAt: new Date(now),
      proposalApproved: true,
      readinessState: "READY_TO_CONVERT",
      qualification: qual({
        furnitureType: "kitchen",
        objectType: "apartment",
        budgetRange: "180000–220000 UAH",
        temperature: "hot",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_ready",
        contactId: "contact_journey_diachenko",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_ready",
      contactId: "contact_journey_diachenko",
      isPrimary: true,
      role: "PRIMARY",
    },
  });
  const estGv3 = await prisma.estimate.upsert({
    where: { id: "est_journey_g_v3" },
    update: { totalPrice: totalG },
    create: {
      id: "est_journey_g_v3",
      leadId: "lead_journey_ready",
      version: 3,
      status: "APPROVED",
      totalPrice: totalG,
      totalCost: linesG.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      grossMargin:
        totalG - linesG.reduce((a, l) => a + (l.amountCost ?? 0), 0),
      discountAmount: discD,
      createdById: iryna.id,
      isActive: true,
      isClientFacing: true,
    },
  });
  await prisma.estimateLineItem.deleteMany({ where: { estimateId: estGv3.id } });
  for (const li of linesG) {
    await prisma.estimateLineItem.create({
      data: {
        estimateId: estGv3.id,
        type: li.type,
        category: li.category,
        productName: li.productName,
        qty: li.qty,
        unit: li.unit,
        salePrice: li.salePrice,
        costPrice: li.costPrice,
        amountSale: li.amountSale,
        amountCost: li.amountCost,
        margin: li.margin,
      },
    });
  }
  const snapG = snapshotJsonFromEstimate(
    {
      id: estGv3.id,
      version: 3,
      totalPrice: totalG,
      discountAmount: discD,
      deliveryCost: 0,
      installationCost: 0,
      notes: null,
    },
    linesG,
  );
  const propG2 = await prisma.leadProposal.upsert({
    where: { id: "prop_journey_g_v2" },
    update: {},
    create: {
      id: "prop_journey_g_v2",
      leadId: "lead_journey_ready",
      estimateId: estGv3.id,
      version: 2,
      status: "APPROVED",
      approvedAt: new Date(now - day),
      title: "КП v2",
      snapshotJson: snapG,
      publicToken: randomBytes(16).toString("base64url").replace(/=/g, ""),
      createdById: iryna.id,
    },
  });
  await prisma.lead.update({
    where: { id: "lead_journey_ready" },
    data: {
      activeEstimateId: estGv3.id,
      activeProposalId: propG2.id,
    },
  });

  /** --- Lead H: втрачений --- */
  await prisma.lead.upsert({
    where: { id: "lead_journey_lost" },
    update: {},
    create: {
      id: "lead_journey_lost",
      title: "Кухня — Бровари / Мельник",
      source: "website",
      pipelineId: pipeline.id,
      stageId: st("lost"),
      priority: "low",
      contactName: "Віктор Мельник",
      phone: "+380671556677",
      contactId: "contact_journey_melnyk",
      ownerId: andrii.id,
      createdById: olena.id,
      note: "Клієнт обрав дешевший варіант",
      qualification: qual({
        furnitureType: "kitchen",
        objectType: "apartment",
        budgetRange: "80000 UAH",
        temperature: "cold",
      }),
    },
  });
  await prisma.leadContact.upsert({
    where: {
      leadId_contactId: {
        leadId: "lead_journey_lost",
        contactId: "contact_journey_melnyk",
      },
    },
    update: { isPrimary: true },
    create: {
      leadId: "lead_journey_lost",
      contactId: "contact_journey_melnyk",
      isPrimary: true,
      role: "PRIMARY",
    },
  });

  /** Вкладення (файли) + активність */
  const attachmentSeed = async (
    id,
    leadId,
    category,
    fileName,
    fileUrl,
  ) => {
    await prisma.attachment.upsert({
      where: { id },
      update: {},
      create: {
        id,
        fileName,
        fileUrl,
        mimeType: "application/pdf",
        fileSize: 12000,
        category,
        entityType: "LEAD",
        entityId: leadId,
        uploadedById: iryna.id,
      },
    });
  };
  await attachmentSeed(
    "att_journey_meas_pdf",
    "lead_journey_meas",
    "MEASUREMENT_SHEET",
    "zmir.pdf",
    "/uploads/seed/measurement-sheet.pdf",
  );
  await attachmentSeed(
    "att_journey_meas_photo",
    "lead_journey_meas",
    "OBJECT_PHOTO",
    "kimnata.jpg",
    "/uploads/seed/room.jpg",
  );
  await attachmentSeed(
    "att_journey_g_render",
    "lead_journey_ready",
    "REFERENCE",
    "vizualizacja.pdf",
    "/uploads/seed/render.pdf",
  );

  const activity = async (entityId, type, data) => {
    await prisma.activityLog.create({
      data: {
        entityType: "LEAD",
        entityId,
        type,
        source: "SYSTEM",
        actorUserId: olena.id,
        data: data ?? {},
      },
    });
  };
  await activity("lead_journey_new", "LEAD_CREATED", { seed: true });
  await activity("lead_journey_qual", "LEAD_UPDATED", { note: "stage" });
  await activity("lead_journey_est_only", "LEAD_UPDATED", {
    note: "estimate",
  });
  await activity("lead_journey_prop_sent", "LEAD_UPDATED", {
    note: "proposal_sent",
  });
  await activity("lead_journey_ready", "LEAD_UPDATED", {
    note: "ready_convert",
  });

  /** Клієнти та угоди */
  const client1 = await prisma.client.upsert({
    where: { id: "client_journey_seed_1" },
    update: {},
    create: {
      id: "client_journey_seed_1",
      name: "Наталія Дяченко (ФОП)",
      type: "PERSON",
    },
  });
  await prisma.contact.update({
    where: { id: "contact_journey_diachenko" },
    data: { clientId: client1.id },
  });

  const deal1 = await prisma.deal.upsert({
    where: { id: "deal_journey_no_contract" },
    update: {},
    create: {
      id: "deal_journey_no_contract",
      title: "Кухня — Вишневе / Дяченко",
      status: "OPEN",
      pipelineId: dealPipeline.id,
      stageId: dealStage("contract"),
      clientId: client1.id,
      primaryContactId: "contact_journey_diachenko",
      ownerId: iryna.id,
      productionManagerId: taras.id,
      leadId: "lead_journey_ready",
      value: 198000,
      currency: "UAH",
      workspaceMeta: {
        qualificationComplete: true,
        measurementComplete: true,
        proposalSent: true,
        health: "at_risk",
        subStatusLabel: "Договір не створено",
      },
    },
  });
  await prisma.lead.update({
    where: { id: "lead_journey_ready" },
    data: { dealId: deal1.id },
  });

  const client2 = await prisma.client.upsert({
    where: { id: "client_journey_seed_2" },
    update: {},
    create: {
      id: "client_journey_seed_2",
      name: "Олена Петренко",
      type: "PERSON",
    },
  });
  await prisma.contact.update({
    where: { id: "contact_journey_petrenko" },
    data: { clientId: client2.id },
  });
  const deal2 = await prisma.deal.upsert({
    where: { id: "deal_journey_prepay_overdue" },
    update: {},
    create: {
      id: "deal_journey_prepay_overdue",
      title: "Шафа — Софіївська Борщагівка / Петренко",
      status: "OPEN",
      pipelineId: dealPipeline.id,
      stageId: dealStage("payment"),
      clientId: client2.id,
      primaryContactId: "contact_journey_petrenko",
      ownerId: andrii.id,
      productionManagerId: taras.id,
      value: 78000,
      currency: "UAH",
      workspaceMeta: {
        qualificationComplete: true,
        proposalSent: true,
        health: "blocked",
        subStatusLabel: "Передоплата прострочена",
        payment: {
          milestones: [
            {
              id: "prepay",
              label: "Передоплата 30%",
              amount: 23400,
              currency: "UAH",
              done: false,
            },
          ],
        },
      },
    },
  });
  await prisma.dealContract.upsert({
    where: { dealId: deal2.id },
    update: {
      status: "SENT_FOR_SIGNATURE",
    },
    create: {
      dealId: deal2.id,
      status: "SENT_FOR_SIGNATURE",
      templateKey: "wardrobe_v1",
      version: 1,
      content: { variables: { customer: client2.name } },
    },
  });
  await prisma.dealPaymentMilestone.upsert({
    where: {
      dealId_sortOrder: {
        dealId: deal2.id,
        sortOrder: 0,
      },
    },
    update: {
      label: "Передоплата 30%",
      amount: 23400,
      currency: "UAH",
      dueAt: yesterday,
    },
    create: {
      dealId: deal2.id,
      sortOrder: 0,
      label: "Передоплата 30%",
      amount: 23400,
      currency: "UAH",
      dueAt: yesterday,
    },
  });

  const client3 = await prisma.client.upsert({
    where: { id: "client_journey_seed_3" },
    update: {},
    create: {
      id: "client_journey_seed_3",
      name: "Світлана Бондар",
      type: "PERSON",
    },
  });
  await prisma.contact.update({
    where: { id: "contact_journey_bondar" },
    data: { clientId: client3.id },
  });
  const instDate = new Date(now + 14 * day);
  const deal3 = await prisma.deal.upsert({
    where: { id: "deal_journey_ready_work" },
    update: {},
    create: {
      id: "deal_journey_ready_work",
      title: "Кухня — Ірпінь / Бондар",
      status: "OPEN",
      pipelineId: dealPipeline.id,
      stageId: dealStage("handoff"),
      clientId: client3.id,
      primaryContactId: "contact_journey_bondar",
      ownerId: iryna.id,
      productionManagerId: taras.id,
      value: 140000,
      currency: "UAH",
      installationDate: instDate,
      workspaceMeta: {
        qualificationComplete: true,
        measurementComplete: true,
        proposalSent: true,
        health: "ok",
        subStatusLabel: "Готовність до виробництва",
        payment: {
          milestones: [
            {
              id: "prepay",
              label: "Передоплата 50%",
              amount: 70000,
              currency: "UAH",
              done: true,
            },
            {
              id: "final",
              label: "Підсумок",
              amount: 70000,
              currency: "UAH",
              done: false,
            },
          ],
        },
        executionChecklist: {
          contactConfirmed: true,
          estimateApproved: true,
          contractCreated: true,
          contractSigned: true,
          prepaymentReceived: true,
          productionStarted: false,
          installationScheduled: true,
        },
      },
    },
  });
  await prisma.dealContract.upsert({
    where: { dealId: deal3.id },
    update: { status: "FULLY_SIGNED" },
    create: {
      dealId: deal3.id,
      status: "FULLY_SIGNED",
      templateKey: "kitchen_v1",
      version: 1,
      content: { variables: { customer: client3.name } },
    },
  });
  await prisma.dealPaymentMilestone.upsert({
    where: {
      dealId_sortOrder: {
        dealId: deal3.id,
        sortOrder: 0,
      },
    },
    update: {
      label: "Передоплата 50%",
      amount: 70000,
      currency: "UAH",
      confirmedAt: new Date(now - 2 * day),
    },
    create: {
      dealId: deal3.id,
      sortOrder: 0,
      label: "Передоплата 50%",
      amount: 70000,
      currency: "UAH",
      confirmedAt: new Date(now - 2 * day),
    },
  });

   
  console.log(
    "[journeys.seed] OK: користувачі olena@crm.local / iryna@crm.local / … пароль journey123",
  );
   
  console.log(
    "[journeys.seed] Ліди: lead_journey_new … lead_journey_lost; угоди: deal_journey_*",
  );
}
