import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";

const root = "D:/crm";
const backupZipPath = "D:/crm/backups/crm-full-backup-2026-03-24T12-52-44.zip";
const tmpDir = "D:/crm/.tmp-restore-finance-procurement-2026-03-24T12-52-44";
const extractedDumpPath = path.join(tmpDir, "2026-03-24T12-52-44", "database.sql");

const candidateTables = [
  "MaterialProvider",
  "MaterialCatalogItem",
  "Order",
  "Estimate",
  "EstimateLineItem",
  "DealPaymentMilestone",
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, description) {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    shell: false,
    env: { ...process.env },
  });
  if (result.status !== 0) {
    throw new Error(
      `${description} failed: ${(result.stderr || result.stdout || "").slice(0, 4000)}`,
    );
  }
  return result;
}

function resolvePsql() {
  const candidates = [
    "C:/Program Files/PostgreSQL/17/bin/psql.exe",
    "C:/Program Files/PostgreSQL/16/bin/psql.exe",
    "C:/Program Files/PostgreSQL/15/bin/psql.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function quoteId(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function getTables(client) {
  const res = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  return new Set(res.rows.map((r) => r.tablename));
}

async function getColumns(client, tableName) {
  const res = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName],
  );
  return res.rows.map((r) => r.column_name);
}

function intersectColumns(preferredOrderColumns, availableColumns) {
  const available = new Set(availableColumns);
  return preferredOrderColumns.filter((c) => available.has(c));
}

async function getIdSet(client, tableName) {
  const res = await client.query(`SELECT id FROM public.${quoteId(tableName)}`);
  return new Set(res.rows.map((r) => r.id));
}

async function selectRows(client, tableName, columns) {
  if (!columns.length) return [];
  const sql = `SELECT ${columns.map(quoteId).join(", ")} FROM public.${quoteId(tableName)}`;
  const res = await client.query(sql);
  return res.rows;
}

async function upsertRows(client, tableName, columns, rows, conflictColumn = "id") {
  if (!rows.length) return 0;
  if (!columns.includes(conflictColumn)) return 0;

  const updateColumns = columns.filter((c) => c !== conflictColumn);
  const pageSize = 400;
  let total = 0;

  for (let i = 0; i < rows.length; i += pageSize) {
    const page = rows.slice(i, i + pageSize);
    const values = [];
    const valuesSql = page
      .map((row, rowIndex) => {
        const placeholders = columns.map((col, colIndex) => {
          values.push(row[col] ?? null);
          return `$${rowIndex * columns.length + colIndex + 1}`;
        });
        return `(${placeholders.join(", ")})`;
      })
      .join(", ");

    const sql = `
      INSERT INTO public.${quoteId(tableName)} (${columns.map(quoteId).join(", ")})
      VALUES ${valuesSql}
      ON CONFLICT (${quoteId(conflictColumn)})
      DO UPDATE SET ${updateColumns
        .map((col) => `${quoteId(col)} = EXCLUDED.${quoteId(col)}`)
        .join(", ")}
    `;
    await client.query(sql, values);
    total += page.length;
  }

  return total;
}

async function main() {
  config({ path: path.join(root, ".env.local") });
  config({ path: path.join(root, ".env") });

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) fail("DATABASE_URL is missing.");

  const psql = resolvePsql();
  if (!psql) fail("psql.exe not found.");
  if (!fs.existsSync(backupZipPath)) fail(`Backup not found: ${backupZipPath}`);

  fs.mkdirSync(tmpDir, { recursive: true });
  if (!fs.existsSync(extractedDumpPath)) {
    run(
      "tar",
      ["-xf", backupZipPath, "-C", tmpDir, "2026-03-24T12-52-44/database.sql"],
      "Extract database.sql from backup zip",
    );
  }
  if (!fs.existsSync(extractedDumpPath)) fail("Extracted database.sql not found.");

  const targetUrl = new URL(databaseUrl);
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";

  const tempDbName = `crm_restore_fp_${Date.now()}`;
  const tempUrl = new URL(databaseUrl);
  tempUrl.pathname = `/${tempDbName}`;

  run(
    psql,
    [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${tempDbName}"`],
    "Create temp database",
  );

  try {
    run(
      psql,
      [tempUrl.toString(), "-v", "ON_ERROR_STOP=1", "-f", extractedDumpPath],
      "Restore backup dump to temp database",
    );

    const source = new Client({ connectionString: tempUrl.toString() });
    const target = new Client({ connectionString: targetUrl.toString() });
    await source.connect();
    await target.connect();

    try {
      const sourceTables = await getTables(source);
      const targetTables = await getTables(target);
      const activeTables = candidateTables.filter(
        (t) => sourceTables.has(t) && targetTables.has(t),
      );

      if (!activeTables.length) {
        fail("No intersecting finance/procurement tables found.");
      }

      const users = targetTables.has("User") ? await getIdSet(target, "User") : new Set();
      const deals = targetTables.has("Deal") ? await getIdSet(target, "Deal") : new Set();
      const leads = targetTables.has("Lead") ? await getIdSet(target, "Lead") : new Set();
      const clients = targetTables.has("Client") ? await getIdSet(target, "Client") : new Set();
      const attachments = targetTables.has("Attachment")
        ? await getIdSet(target, "Attachment")
        : new Set();

      let totalCopied = 0;

      if (activeTables.includes("MaterialProvider")) {
        const targetCols = await getColumns(target, "MaterialProvider");
        const sourceCols = await getColumns(source, "MaterialProvider");
        const cols = intersectColumns(targetCols, sourceCols);
        const rows = await selectRows(source, "MaterialProvider", cols);
        const count = await upsertRows(target, "MaterialProvider", cols, rows);
        totalCopied += count;
        console.log(`MaterialProvider upserted: ${count}`);
      }

      const providerIds = targetTables.has("MaterialProvider")
        ? await getIdSet(target, "MaterialProvider")
        : new Set();

      if (activeTables.includes("MaterialCatalogItem")) {
        const targetCols = await getColumns(target, "MaterialCatalogItem");
        const sourceCols = await getColumns(source, "MaterialCatalogItem");
        const cols = intersectColumns(targetCols, sourceCols);
        const rows = await selectRows(source, "MaterialCatalogItem", cols);
        const filtered = rows.filter((r) => providerIds.has(r.providerId));
        const count = await upsertRows(target, "MaterialCatalogItem", cols, filtered);
        totalCopied += count;
        console.log(`MaterialCatalogItem upserted: ${count} (from ${rows.length})`);
      }

      if (activeTables.includes("Order")) {
        const targetCols = await getColumns(target, "Order");
        const sourceCols = await getColumns(source, "Order");
        const cols = intersectColumns(targetCols, sourceCols);
        const rows = await selectRows(source, "Order", cols);
        const normalized = rows.map((r) => ({
          ...r,
          managerId: r.managerId && users.has(r.managerId) ? r.managerId : null,
          dealId: r.dealId && deals.has(r.dealId) ? r.dealId : null,
          clientId: r.clientId && clients.has(r.clientId) ? r.clientId : null,
        }));
        const count = await upsertRows(target, "Order", cols, normalized);
        totalCopied += count;
        console.log(`Order upserted: ${count}`);
      }

      const restoredEstimateIds = new Set();
      if (activeTables.includes("Estimate")) {
        const targetCols = await getColumns(target, "Estimate");
        const sourceCols = await getColumns(source, "Estimate");
        const cols = intersectColumns(targetCols, sourceCols);
        const rows = await selectRows(source, "Estimate", cols);
        const normalized = rows
          .filter((r) => users.has(r.createdById))
          .map((r) => ({
            ...r,
            dealId: r.dealId && deals.has(r.dealId) ? r.dealId : null,
            leadId: r.leadId && leads.has(r.leadId) ? r.leadId : null,
            approvedById: r.approvedById && users.has(r.approvedById) ? r.approvedById : null,
          }));
        for (const row of normalized) restoredEstimateIds.add(row.id);
        const count = await upsertRows(target, "Estimate", cols, normalized);
        totalCopied += count;
        console.log(`Estimate upserted: ${count} (from ${rows.length})`);
      }

      if (activeTables.includes("EstimateLineItem")) {
        const targetCols = await getColumns(target, "EstimateLineItem");
        const sourceCols = await getColumns(source, "EstimateLineItem");
        const baseCols = intersectColumns(targetCols, sourceCols);
        const rows = await selectRows(source, "EstimateLineItem", baseCols);
        const filtered = rows
          .filter((r) => restoredEstimateIds.has(r.estimateId))
          .map((r, idx) => {
            const next = { ...r };
            if (targetCols.includes("stableLineId") && !sourceCols.includes("stableLineId")) {
              next.stableLineId = r.id;
            }
            if (targetCols.includes("sortOrder") && !sourceCols.includes("sortOrder")) {
              next.sortOrder = idx;
            }
            return next;
          });
        const cols = [
          ...baseCols,
          ...(targetCols.includes("stableLineId") && !sourceCols.includes("stableLineId")
            ? ["stableLineId"]
            : []),
          ...(targetCols.includes("sortOrder") && !sourceCols.includes("sortOrder")
            ? ["sortOrder"]
            : []),
        ];
        const count = await upsertRows(target, "EstimateLineItem", cols, filtered);
        totalCopied += count;
        console.log(`EstimateLineItem upserted: ${count} (from ${rows.length})`);
      }

      if (activeTables.includes("DealPaymentMilestone")) {
        const targetCols = await getColumns(target, "DealPaymentMilestone");
        const sourceCols = await getColumns(source, "DealPaymentMilestone");
        const cols = intersectColumns(targetCols, sourceCols);
        const rows = await selectRows(source, "DealPaymentMilestone", cols);
        const filtered = rows
          .filter((r) => deals.has(r.dealId))
          .map((r) => ({
            ...r,
            confirmedById:
              r.confirmedById && users.has(r.confirmedById) ? r.confirmedById : null,
            proofAttachmentId:
              r.proofAttachmentId && attachments.has(r.proofAttachmentId)
                ? r.proofAttachmentId
                : null,
          }));
        const count = await upsertRows(target, "DealPaymentMilestone", cols, filtered);
        totalCopied += count;
        console.log(`DealPaymentMilestone upserted: ${count} (from ${rows.length})`);
      }

      console.log(`Done. Rows upserted: ${totalCopied}`);
    } finally {
      await source.end();
      await target.end();
    }
  } finally {
    try {
      run(
        psql,
        [
          adminUrl.toString(),
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${tempDbName}' AND pid <> pg_backend_pid();`,
        ],
        "Terminate temp database sessions",
      );
    } catch (e) {
      console.warn(
        `Warning: could not terminate sessions for temp DB: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    try {
      run(
        psql,
        [adminUrl.toString(), "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${tempDbName}"`],
        "Drop temp database",
      );
    } catch (e) {
      console.warn(
        `Warning: could not drop temp DB: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

main().catch((err) => {
  fail(`Restore via temp DB failed: ${err instanceof Error ? err.message : String(err)}`);
});
