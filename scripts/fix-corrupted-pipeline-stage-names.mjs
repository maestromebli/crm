import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });
config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL не знайдено");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString });
const DRY_RUN = !process.argv.includes("--apply");

const FALLBACK_STAGE_NAMES = {
  LEAD: {
    new: "Новий",
    working: "В роботі",
    contact: "Контакт",
    qualification: "Кваліфікація",
    measurement: "Замір",
    site_visit: "Виїзд на обʼєкт",
    estimating: "Розрахунок",
    calculation: "Розрахунок",
    quote_draft: "Чернетка КП",
    proposal_draft: "Чернетка КП",
    quote_sent: "КП надіслано",
    proposal_sent: "КП надіслано",
    negotiating: "Узгодження",
    approved: "Погоджено",
    ready_convert: "Готово до замовлення",
    proposal_approved: "КП погоджено",
    quote_approved: "КП погоджено",
    kp_approved: "КП погоджено",
    agreed: "Узгоджено",
    qualified: "Розрахунок",
    client: "Клієнт",
    clients: "Клієнти",
    control_measurement: "Контрольний замір",
    contract: "Договір",
    deal: "Замовлення",
    production_ready: "Готово до виробництва",
    handoff_ready: "Готово до передачі",
    won: "Завершено",
    lost: "Закритий — втрата",
    archived: "Архів",
  },
  DEAL: {
    qualification: "Кваліфікація",
    measurement: "Замір",
    proposal: "КП",
    contract: "Договір",
    payment: "Оплата",
    handoff: "Передача",
    production: "Виробництво",
    won: "Завершено",
    lost: "Закрито — втрата",
  },
};

function isCorruptedDisplayText(value) {
  const text = String(value ?? "").trim();
  if (!text) return true;
  const questionMarks = (text.match(/\?/g) ?? []).length;
  const replacementChars = (text.match(/�/g) ?? []).length;
  const letters = (text.match(/[A-Za-zА-Яа-яІіЇїЄєҐґ]/g) ?? []).length;
  const placeholders = questionMarks + replacementChars;
  return letters === 0 && placeholders >= Math.max(2, Math.floor(text.length * 0.5));
}

async function main() {
  const result = await pool.query(`
    select
      ps.id,
      ps.name,
      ps.slug,
      p."entityType" as entity_type
    from "PipelineStage" ps
    join "Pipeline" p on p.id = ps."pipelineId"
    order by p."entityType", ps."sortOrder" asc
  `);

  const candidates = result.rows
    .map((row) => {
      const mapped = FALLBACK_STAGE_NAMES[row.entity_type]?.[row.slug] ?? null;
      if (mapped && row.name !== mapped) {
        return {
          id: row.id,
          entityType: row.entity_type,
          slug: row.slug,
          oldName: row.name,
          newName: mapped,
        };
      }
      if (isCorruptedDisplayText(row.name) && mapped) {
        return {
          id: row.id,
          entityType: row.entity_type,
          slug: row.slug,
          oldName: row.name,
          newName: mapped,
        };
      }
      return null;
    })
    .filter(Boolean);

  if (candidates.length === 0) {
    console.log(JSON.stringify({ dryRun: DRY_RUN, updated: 0, rows: [] }, null, 2));
    return;
  }

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        { dryRun: true, updated: candidates.length, rows: candidates },
        null,
        2,
      ),
    );
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const row of candidates) {
      await client.query(
        `update "PipelineStage" set name = $2 where id = $1`,
        [row.id, row.newName],
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(
    JSON.stringify(
      { dryRun: false, updated: candidates.length, rows: candidates },
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
    await pool.end();
  });
