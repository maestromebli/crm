import path from "node:path";
import { config } from "dotenv";
import XLSX from "xlsx";
import bcrypt from "bcryptjs";
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

const filePath = process.argv[2] || "C:\\Users\\user\\Desktop\\РЕЗУЛЬТАТ 2026 (7).xlsx";
const sheetNameArg = process.argv[3] || "20.04.";

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d);
  }
  if (typeof value === "string" && value.trim()) {
    const iso = new Date(value);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  return null;
}

function str(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function buildNumber(rawNumber, rowNumber) {
  const base = str(rawNumber) || `XLSX-${rowNumber}`;
  return `${base}-${String(rowNumber).padStart(4, "0")}`;
}

async function ensureDealPipeline() {
  let pipeline = await prisma.pipeline.findFirst({
    where: { entityType: "DEAL", name: "Імпорт XLSX закупівель" },
    include: { stages: true },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        name: "Імпорт XLSX закупівель",
        entityType: "DEAL",
        isDefault: false,
        stages: {
          create: [
            {
              name: "Імпортовано",
              slug: "imported",
              sortOrder: 0,
              isFinal: false,
            },
          ],
        },
      },
      include: { stages: true },
    });
  }

  const stage = pipeline.stages.find((s) => s.slug === "imported");
  if (!stage) {
    throw new Error("Не знайдено стадію imported у pipeline імпорту");
  }

  return { pipelineId: pipeline.id, stageId: stage.id };
}

async function main() {
  const workbook = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = workbook.SheetNames.includes(sheetNameArg) ? sheetNameArg : workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("У файлі немає аркушів для імпорту");
  }

  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const adminHash = await bcrypt.hash("import123", 10);
  const user = await prisma.user.create({
    data: {
      email: "import@enver.local",
      name: "Імпорт XLSX",
      passwordHash: adminHash,
      role: "SUPER_ADMIN",
    },
  });

  const client = await prisma.client.create({
    data: {
      name: "Клієнти з імпорту XLSX",
      type: "COMPANY",
      notes: `Джерело: ${path.basename(filePath)} / ${sheetName}`,
    },
  });

  const { pipelineId, stageId } = await ensureDealPipeline();

  let imported = 0;
  for (let idx = 3; idx < rows.length; idx += 1) {
    const row = rows[idx] ?? [];
    const date = asDate(row[1]);
    const rawNumber = row[2];
    const objectName = str(row[3]);
    const cost = asNumber(row[4]);
    const advance = asNumber(row[5]);
    const costs = asNumber(row[6]);
    const measurements = asNumber(row[7]);
    const percent = asNumber(row[8]);
    const debt = asNumber(row[9]);
    const settlement = asNumber(row[10]);
    const salaryPercent = asNumber(row[11]);
    const install = asNumber(row[12]);
    const assembly = asNumber(row[13]);
    const constructor = asNumber(row[14]);
    const comment = str(row[15]);

    const hasCore = objectName || rawNumber || cost !== null || advance !== null || costs !== null || debt !== null;
    if (!hasCore) continue;

    const number = buildNumber(rawNumber, idx + 1);
    const title = objectName || `Імпортований об'єкт ${number}`;
    const value = cost ?? 0;

    const deal = await prisma.deal.create({
      data: {
        title,
        description: `Імпорт з Excel: ${path.basename(filePath)}; рядок ${idx + 1}`,
        status: "OPEN",
        pipelineId,
        stageId,
        clientId: client.id,
        ownerId: user.id,
        expectedCloseDate: date ?? null,
        value,
        currency: "UAH",
        workspaceMeta: {
          source: "xlsx_import",
          rowIndex: idx + 1,
          sheet: sheetName,
          fileName: path.basename(filePath),
        },
      },
    });

    const request = await prisma.procurementRequest.create({
      data: {
        number,
        dealId: deal.id,
        requesterId: user.id,
        responsibleUserId: user.id,
        source: "xlsx_import",
        status: "new",
        workflowStatus: "new_request",
        approvalStatus: null,
        priority: "normal",
        requestDate: date ?? new Date(),
        plannedTotal: cost,
        actualTotal: costs,
        currency: "UAH",
        comment: comment ?? null,
      },
    });

    await prisma.procurementRequestItem.create({
      data: {
        requestId: request.id,
        name: title,
        unit: "послуга",
        itemType: "service",
        reservationStatus: "none",
        qtyPlanned: 1,
        qtyOrdered: 1,
        qtyReceived: 1,
        qtyIssued: 1,
        plannedPrice: cost ?? 0,
        actualPrice: costs ?? cost ?? 0,
        costPlanned: cost ?? 0,
        costActual: costs ?? cost ?? 0,
        status: "imported",
        comment: JSON.stringify({
          date: date ? date.toISOString().slice(0, 10) : null,
          advance,
          measurements,
          percent,
          debt,
          settlement,
          salaryPercent,
          install,
          assembly,
          constructor,
          originalComment: comment,
        }),
      },
    });

    await prisma.procurementRequestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: null,
        toStatus: "new",
        actorId: user.id,
        actorRole: "SUPER_ADMIN",
        reason: "Початковий імпорт з XLSX",
        payload: {
          importedFrom: path.basename(filePath),
          sheet: sheetName,
          row: idx + 1,
        },
      },
    });

    imported += 1;
  }

  console.log(`Import done. sheet=${sheetName} imported_rows=${imported}`);
  console.log("User for login:", "import@enver.local / import123");
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
