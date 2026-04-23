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

const RAW = `
(E-40) Кухня Борнелль (Людмила)
(E-88) Глєтнієв во польщі
(E-111) Галактика меблі
(E-12) Галактика камінь
(E-54) Кухня Шапа
(E-72) Файна Таун Олег (NSD)
(E-83) Клініка Косметикс (Цальо)
(E-92) Кухня ЖК Республіка Ольга (ВВ)
(E-921) Стільниця жк Республіка Ольга (ВВ)
(E-94) ЖК Варшавський плюс Меблі (Ігорем)
(E-941) ЖК Варшавський плюс Стільниця (Ігорем)
(E-97) Кухня та Юрківську SD
(E-971) Стільниця на Юрківську SD
(E-98) ЖК Грейт 358 Ігорем
(E-100) Візія Гуліцейць
(E-105) ЖК Юніт Хоум ВВ
(E-114) ЖК Манхеттен (Кириленко)
(E-118) ЖК Файна Таун
(E-118.1) ЖК Файна Таун стільниця
(E-122) ЖК Грейт 193 Ігорем
(E-123) ЖК Парк ренессанс.Олег ВВ
(E-1237) Стільниця з раковиною в санвузол Парк Ренесанс
(E-125) Хомеко Роман (Кухня/рафа..)
(E-127) Кухня на Родине Крігерн
(E-128) Шафа+тумба в спальню МА
(EM-01) Яша
(EM-02) Кухня на Ігорівській
(EM-02.1) Стільниця на Ігорівській
(EM-04) Олексій Чапайка
(EM-05) Шафа в коридор Файна Мія (Таня ВВ)
(EM-06) Зіпченко меблі
(EM-07) Кухня Анна Іванків
(EM-07.1) Стільниця Anna Ivanik
(EM-08) Детир Барп Ори
(EM-09) Меблі на Юрківську
(EM-10) ЖК Автоград/Валентин (+ % ВВ)
(EM-11) ЖК Автоград/Роберт
(EM-12) Грейт 357 Ігорем
(EM-13) Стільниця жк Юніт хоум ВВ
(EM-14) ЖК Республіка/Володимир ВВ
(EM-15) Стільниця п санвузли/Оскорет
(EM-16) Осокорки 2 частина
(EM-17) Уайб ЖК Республіка
(EM-18) Лазалетне Манежи
(EM-19) ЖК Метрополіс SD
(EM-19.1) ЖК Метрополіс стільниці SD
(EM-20) Кухня Мая
(EM-21) Яшуа мансард
(EM-22) ЖК Варшавський.Тюльпети/переробка тумби
(EM-23) Васильківська кв.38 (Чапайка)
(EM-24) Васильківська кв.48 (Чапайка)
(EM-25) Меблі Малишенко Івансів
(EM-26) Шафа в клініку (Пантелєпа)
(EM-27) Переполки Інна (Іванків)
(EM-28) Стілмірі Рудики
(EM-29) Передпокій Тарас
(EM-30) Запіна стільниці/ Леза звучь без дивану
(EM-31) Санвузол/ вул. Ігорівська
(EM-32) Шафи ЖК Республіка ВВ
(EM-33) ЖК Нивки парк 3к (Чапайка)
(EM-34) Стільниця на Хаджу (індивідуально)
(EM-35) Шафа на Ігорівську
(EM-36) ЖК LIKO GRID/Strokova Design
(EM-37) Янута
(EM-38) Осокорки/спальня
(EM-39) Фасади в Нивку МА
(EM-40) Дитяча з Ходосівку (Даніель)
(EM-41) ЖК Артекпорт.Ігорем
(EM-42) Полина на кухню+Папки (запуск без авансу)
(EM-43) Манхеттен Макетт/Пателіт+петля
(EM-44) Іварковичі/Стеравк в спальню 1 етап Dominedesign
(EM-45) Офіс на Берестейському (Таня Шпапйва)
(EM-46) Кабінет Малашенко
(EM-47) ЖК Грейт 357 (2у) Ігорем
(EM-48) ЖК Республіка кв 123/ Ігорем
(EM-49) ЖК Олегал / Ігорем
(EM-50) ЖК Грейт 310/ Ігорем
(EM-51) ЖК Шевченківський/Драгомирецька
(EM-52) Санвузол на Юрківську SD
(EM-53) Шафа 2ч/вул. Ігорівська Кирило
(EM-54) МАХ
`;

function parseRows(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^\(([^)]+)\)\s+(.+)$/.exec(line);
      if (!m) return null;
      return {
        orderNumber: m[1].trim().replace(/\s+/g, ""),
        customerName: m[2].trim(),
      };
    })
    .filter(Boolean);
}

async function main() {
  const rows = parseRows(RAW);
  if (rows.length === 0) {
    throw new Error("Немає рядків для імпорту");
  }

  const uniqueByNumber = new Map();
  for (const row of rows) {
    if (!uniqueByNumber.has(row.orderNumber)) {
      uniqueByNumber.set(row.orderNumber, row);
    }
  }
  const uniqueRows = [...uniqueByNumber.values()];

  const existing = await prisma.order.findMany({
    where: { orderNumber: { in: uniqueRows.map((r) => r.orderNumber) } },
    select: { orderNumber: true },
  });
  const existingSet = new Set(existing.map((r) => r.orderNumber));

  let created = 0;
  let skipped = 0;
  for (const row of uniqueRows) {
    if (existingSet.has(row.orderNumber)) {
      skipped += 1;
      continue;
    }
    await prisma.order.create({
      data: {
        orderNumber: row.orderNumber,
        customerName: row.customerName,
        status: "NEW",
        source: "image-import-2026-04-21",
        amount: null,
        currency: "UAH",
        comment: "Імпорт зі скріншота списку замовлень",
      },
    });
    created += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalParsed: rows.length,
        uniqueRows: uniqueRows.length,
        created,
        skippedExisting: skipped,
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
