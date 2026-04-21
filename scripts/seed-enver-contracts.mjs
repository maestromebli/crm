import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL?.trim() || "postgresql://127.0.0.1:5432/postgres",
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

const DEFAULT_TEMPLATE_CODE = "ENVER_SUPPLY_CONTRACT";

const DEFAULT_TEMPLATE_HTML = `
<h1 style="margin:0 0 12px;">Договір №{{contract.number}}</h1>
<p><strong>Дата:</strong> {{contract.date}}</p>
<p><strong>Замовник:</strong> {{client.name}}</p>
<p><strong>Телефон:</strong> {{client.phone}}</p>
<p><strong>Email:</strong> {{client.email}}</p>
<p><strong>Адреса об'єкта:</strong> {{order.address}}</p>
<p><strong>Сума:</strong> {{order.amount}}</p>
<hr />
<p>Сторони погодилися з умовами виконання робіт та порядком оплати.</p>
`.trim();

const DEFAULT_VARIABLES = [
  { key: "contract.number", label: "Номер договору", type: "string", required: true },
  { key: "contract.date", label: "Дата договору", type: "date", required: true },
  { key: "client.name", label: "Ім'я клієнта", type: "string", required: true },
  { key: "client.phone", label: "Телефон клієнта", type: "string", required: false },
  { key: "client.email", label: "Email клієнта", type: "string", required: false },
  { key: "order.address", label: "Адреса об'єкта", type: "string", required: false },
  { key: "order.amount", label: "Сума замовлення", type: "number", required: true },
];

const DEFAULT_SETTINGS = {
  providerOverride: "VCHASNO",
  expiryDays: 7,
  approvalRequired: false,
  reminderDays: [1, 3],
  defaultPartyMapping: [
    { role: "CUSTOMER", source: "client", signOrder: 1 },
    { role: "COMPANY", source: "company", signOrder: 2 },
  ],
};

async function main() {
  await prisma.enverContractSetting.upsert({
    where: { key: "company_legal_defaults" },
    update: {
      valueJson: {
        companyName: "ENVER",
        companyAddress: "м. Київ",
        signerName: "Уповноважена особа",
        signerBasis: "Статут",
      },
    },
    create: {
      key: "company_legal_defaults",
      valueJson: {
        companyName: "ENVER",
        companyAddress: "м. Київ",
        signerName: "Уповноважена особа",
        signerBasis: "Статут",
      },
    },
  });

  await prisma.enverContractSetting.upsert({
    where: { key: "module_defaults" },
    update: {
      valueJson: {
        providerDefault: "VCHASNO",
        gateEnabled: true,
      },
    },
    create: {
      key: "module_defaults",
      valueJson: {
        providerDefault: "VCHASNO",
        gateEnabled: true,
      },
    },
  });

  const existingPublished = await prisma.enverContractTemplate.findFirst({
    where: { code: DEFAULT_TEMPLATE_CODE, status: "PUBLISHED", isActive: true },
    orderBy: { version: "desc" },
  });

  if (!existingPublished) {
    const latest = await prisma.enverContractTemplate.findFirst({
      where: { code: DEFAULT_TEMPLATE_CODE },
      orderBy: { version: "desc" },
    });

    if (latest?.status === "PUBLISHED" && latest.isActive) {
      await prisma.enverContractTemplate.updateMany({
        where: { code: DEFAULT_TEMPLATE_CODE, status: "PUBLISHED" },
        data: { status: "ARCHIVED", isActive: false },
      });
    }

    await prisma.enverContractTemplate.create({
      data: {
        code: DEFAULT_TEMPLATE_CODE,
        name: "Базовий договір поставки ENVER",
        documentType: "supply_contract",
        language: "uk",
        version: (latest?.version ?? 0) + 1,
        status: "PUBLISHED",
        isActive: true,
        bodyHtml: DEFAULT_TEMPLATE_HTML,
        variablesSchemaJson: DEFAULT_VARIABLES,
        settingsJson: DEFAULT_SETTINGS,
        approvalRequired: false,
      },
    });
  }

  console.log("ENVER contracts seed completed");
}

main()
  .catch((error) => {
    console.error("ENVER contracts seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
