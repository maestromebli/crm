import { config } from "dotenv";
import XLSX from "xlsx";
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

function toStr(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNum(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/\s+/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }
  if (typeof value === "string" && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function normalizeOrderNumber(raw) {
  const cleaned = toStr(raw)
    .replace(/[()]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const m = /^([A-ZА-ЯІЇЄҐ]{1,4}-\d{1,4}(?:\.\d{1,2})?)$/u.exec(cleaned);
  return m ? m[1] : null;
}

function orderNumberVariants(orderNumber) {
  const latin = orderNumber
    .replaceAll("Е", "E")
    .replaceAll("М", "M")
    .replaceAll("І", "I")
    .replaceAll("А", "A")
    .replaceAll("В", "B")
    .replaceAll("К", "K")
    .replaceAll("О", "O")
    .replaceAll("Р", "P")
    .replaceAll("С", "C")
    .replaceAll("Т", "T")
    .replaceAll("Х", "X");
  const variants = new Set([orderNumber, latin]);
  return [...variants];
}

async function main() {
  const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName = wb.SheetNames.includes(sheetNameArg) ? sheetNameArg : wb.SheetNames[0];
  if (!sheetName) throw new Error("Не знайдено аркушів у файлі");

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const payload = [];
  for (const row of rows) {
    const orderNumber =
      normalizeOrderNumber(row?.[0]) ?? normalizeOrderNumber(row?.[2]);
    if (!orderNumber) continue;
    const fromCompactLayout = normalizeOrderNumber(row?.[0]) !== null;
    const objectName = toStr(fromCompactLayout ? row?.[1] : row?.[3]);
    payload.push({
      orderNumber,
      objectName,
      cost: toNum(fromCompactLayout ? row?.[2] : row?.[4]),
      advance: toNum(fromCompactLayout ? row?.[3] : row?.[5]),
      costs: toNum(fromCompactLayout ? row?.[4] : row?.[6]),
      measurements: toNum(fromCompactLayout ? row?.[5] : row?.[7]),
      installation: toNum(fromCompactLayout ? row?.[11] : row?.[11]),
      assembly: toNum(fromCompactLayout ? row?.[12] : row?.[12]),
      constructor: toNum(fromCompactLayout ? row?.[13] : row?.[13]),
      manager: toNum(fromCompactLayout ? row?.[14] : row?.[14]),
      percent: toNum(fromCompactLayout ? row?.[6] : row?.[8]),
      debt: toNum(fromCompactLayout ? row?.[7] : row?.[9]),
      date: toDate(fromCompactLayout ? row?.[8] : row?.[1]) ?? new Date(),
    });
  }

  let updatedDeals = 0;
  let missedDeals = 0;
  let payrollRowsImported = 0;
  const missed = [];

  for (const item of payload) {
    const variants = orderNumberVariants(item.orderNumber);
    const deal = await prisma.deal.findFirst({
      where: {
        OR: variants.flatMap((variant) => [
          { title: { startsWith: `${variant} ·` } },
          { title: { startsWith: `${variant} ` } },
          { title: { startsWith: `${variant}.` } },
        ]),
      },
      select: {
        id: true,
        ownerId: true,
        workspaceMeta: true,
      },
    });

    if (!deal) {
      missedDeals += 1;
      missed.push(item.orderNumber);
      continue;
    }

    const marker = `[XLSX:${item.orderNumber}]`;
    await prisma.$transaction(async (tx) => {
      const currentMeta =
        deal.workspaceMeta && typeof deal.workspaceMeta === "object" && !Array.isArray(deal.workspaceMeta)
          ? deal.workspaceMeta
          : {};

      await tx.deal.update({
        where: { id: deal.id },
        data: {
          ...(item.cost !== null ? { value: item.cost } : {}),
          currency: "UAH",
          workspaceMeta: {
            ...currentMeta,
            xlsxSync: {
              source: "РЕЗУЛЬТАТ 2026 (7).xlsx",
              sheet: sheetName,
              orderNumber: item.orderNumber,
              objectName: item.objectName,
              cost: item.cost,
              advance: item.advance,
              costs: item.costs,
              measurements: item.measurements,
              percent: item.percent,
              debt: item.debt,
              syncedAt: new Date().toISOString(),
            },
          },
        },
      });

      await tx.moneyTransaction.deleteMany({
        where: {
          dealId: deal.id,
          description: { contains: marker },
        },
      });

      await tx.financeTransaction.deleteMany({
        where: {
          dealId: deal.id,
          category: { contains: marker },
        },
      });

      await tx.payrollEntry.deleteMany({
        where: {
          dealId: deal.id,
          type: { contains: marker },
        },
      });

      if (item.advance !== null && item.advance > 0) {
        await tx.moneyTransaction.create({
          data: {
            dealId: deal.id,
            type: "INCOME",
            category: "PREPAYMENT",
            amount: item.advance,
            currency: "UAH",
            status: "PAID",
            paidAt: item.date,
            dueDate: item.date,
            description: `${marker} Аванс`,
          },
        });
      }

      if (item.costs !== null && item.costs > 0) {
        await tx.financeTransaction.create({
          data: {
            dealId: deal.id,
            type: "EXPENSE",
            amount: item.costs,
            currency: "UAH",
            date: item.date,
            status: "CONFIRMED",
            category: `Затрати ${marker}`,
            affectsCash: true,
          },
        });
      }

      if (item.measurements !== null && item.measurements > 0) {
        await tx.financeTransaction.create({
          data: {
            dealId: deal.id,
            type: "EXPENSE",
            amount: item.measurements,
            currency: "UAH",
            date: item.date,
            status: "CONFIRMED",
            category: `Заміри ${marker}`,
            affectsCash: true,
          },
        });
      }

      if (item.installation !== null && item.installation > 0) {
        await tx.payrollEntry.create({
          data: {
            dealId: deal.id,
            employeeId: deal.ownerId,
            amount: item.installation,
            type: `установка ${marker}`,
            status: "CONFIRMED",
          },
        });
        payrollRowsImported += 1;
      }
      if (item.assembly !== null && item.assembly > 0) {
        await tx.payrollEntry.create({
          data: {
            dealId: deal.id,
            employeeId: deal.ownerId,
            amount: item.assembly,
            type: `зборка ${marker}`,
            status: "CONFIRMED",
          },
        });
        payrollRowsImported += 1;
      }
      if (item.constructor !== null && item.constructor > 0) {
        await tx.payrollEntry.create({
          data: {
            dealId: deal.id,
            employeeId: deal.ownerId,
            amount: item.constructor,
            type: `констр ${marker}`,
            status: "CONFIRMED",
          },
        });
        payrollRowsImported += 1;
      }
      if (item.manager !== null && item.manager > 0) {
        await tx.payrollEntry.create({
          data: {
            dealId: deal.id,
            employeeId: deal.ownerId,
            amount: item.manager,
            type: `менеджер ${marker}`,
            status: "CONFIRMED",
          },
        });
        payrollRowsImported += 1;
      }
    });

    updatedDeals += 1;
  }

  console.log(
    JSON.stringify(
      {
        sheet: sheetName,
        parsedRows: payload.length,
        updatedDeals,
        payrollRowsImported,
        missedDeals,
        missedOrderNumbers: missed.slice(0, 30),
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
