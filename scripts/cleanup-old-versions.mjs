import { config } from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

const APPLY = process.argv.includes("--apply");

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function pickLatestByNumber(rows, key) {
  return rows.reduce((acc, row) => {
    if (!acc) return row;
    if (row[key] > acc[key]) return row;
    if (row[key] === acc[key] && row.createdAt > acc.createdAt) return row;
    return acc;
  }, null);
}

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const bucketKey = row[key];
    if (!bucketKey) continue;
    const bucket = map.get(bucketKey) ?? [];
    bucket.push(row);
    map.set(bucketKey, bucket);
  }
  return map;
}

async function buildPlan(tx) {
  const plan = {
    available: {
      estimate: false,
      leadProposal: false,
      dealContract: false,
      dealContractVersion: false,
      constructorVersion: false,
      pricingSession: false,
      pricingVersion: false,
      lead: false,
    },
    estimates: { keepIds: new Set(), deleteIds: [] },
    leadProposals: { keepIds: new Set(), deleteIds: [] },
    dealContractVersions: { keepIds: new Set(), deleteIds: [] },
    constructorVersions: { keepIds: new Set(), deleteIds: [] },
    pricingVersions: { keepIds: new Set(), deleteIds: [] },
    pointerUpdates: {
      leadsActiveEstimate: 0,
      leadsActiveProposal: 0,
      contractsCurrentVersion: 0,
      pricingSessionsActiveVersion: 0,
      constructorCurrentReset: 0,
      constructorCurrentSet: 0,
    },
  };

  const tableRows = await tx.$queryRawUnsafe(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
  `);
  const tableSet = new Set(
    Array.isArray(tableRows)
      ? tableRows
          .map((row) => row?.table_name)
          .filter((name) => typeof name === "string")
      : [],
  );

  plan.available.estimate = tableSet.has("Estimate");
  plan.available.leadProposal = tableSet.has("LeadProposal");
  plan.available.dealContract = tableSet.has("DealContract");
  plan.available.dealContractVersion = tableSet.has("DealContractVersion");
  plan.available.constructorVersion = tableSet.has("ConstructorVersion");
  plan.available.pricingSession = tableSet.has("PricingSession");
  plan.available.pricingVersion = tableSet.has("PricingVersion");
  plan.available.lead = tableSet.has("Lead");

  // Estimates
  if (plan.available.estimate) {
    const estimates = await tx.estimate.findMany({
      select: {
        id: true,
        leadId: true,
        dealId: true,
        version: true,
        createdAt: true,
        isActive: true,
      },
    });
    const estimateBuckets = new Map();
    for (const row of estimates) {
      const k = row.leadId ? `lead:${row.leadId}` : row.dealId ? `deal:${row.dealId}` : null;
      if (!k) continue;
      const arr = estimateBuckets.get(k) ?? [];
      arr.push(row);
      estimateBuckets.set(k, arr);
    }
    for (const rows of estimateBuckets.values()) {
      if (rows.length <= 1) {
        plan.estimates.keepIds.add(rows[0].id);
        continue;
      }
      const active = rows.find((x) => x.isActive);
      const keep = active ?? pickLatestByNumber(rows, "version");
      plan.estimates.keepIds.add(keep.id);
      for (const row of rows) {
        if (row.id !== keep.id) plan.estimates.deleteIds.push(row.id);
      }
    }
  }

  // Lead proposals
  if (plan.available.leadProposal) {
    const proposals = await tx.leadProposal.findMany({
      select: {
        id: true,
        leadId: true,
        version: true,
        createdAt: true,
      },
    });
    const proposalByLead = groupBy(proposals, "leadId");
    const leadPointers =
      plan.available.lead
        ? await tx.lead.findMany({
            where: { activeProposalId: { not: null } },
            select: { id: true, activeProposalId: true },
          })
        : [];
    const proposalPointerByLead = new Map(
      leadPointers.map((x) => [x.id, x.activeProposalId]).filter((x) => Boolean(x[1])),
    );
    for (const [leadId, rows] of proposalByLead.entries()) {
      const pointedId = proposalPointerByLead.get(leadId);
      const keep =
        (pointedId && rows.find((x) => x.id === pointedId)) ??
        pickLatestByNumber(rows, "version");
      if (!keep) continue;
      plan.leadProposals.keepIds.add(keep.id);
      for (const row of rows) {
        if (row.id !== keep.id) plan.leadProposals.deleteIds.push(row.id);
      }
    }
  }

  // Deal contract versions
  const contractKeep = new Map();
  if (plan.available.dealContract && plan.available.dealContractVersion) {
    const contracts = await tx.dealContract.findMany({
      select: { id: true, currentVersionId: true },
    });
    const versions = await tx.dealContractVersion.findMany({
      select: { id: true, contractId: true, revision: true, createdAt: true },
    });
    const versionsByContract = groupBy(versions, "contractId");
    for (const c of contracts) {
      const rows = versionsByContract.get(c.id) ?? [];
      if (rows.length === 0) continue;
      const pointed = c.currentVersionId
        ? rows.find((x) => x.id === c.currentVersionId)
        : null;
      const keep = pointed ?? pickLatestByNumber(rows, "revision");
      contractKeep.set(c.id, keep);
      plan.dealContractVersions.keepIds.add(keep.id);
      for (const row of rows) {
        if (row.id !== keep.id) plan.dealContractVersions.deleteIds.push(row.id);
      }
    }
  }

  // Constructor versions
  const constructorKeepByWorkspace = new Map();
  if (plan.available.constructorVersion) {
    const constructorVersions = await tx.constructorVersion.findMany({
      select: {
        id: true,
        workspaceId: true,
        versionNumber: true,
        createdAt: true,
        isCurrent: true,
      },
    });
    const constructorByWorkspace = groupBy(constructorVersions, "workspaceId");
    for (const [workspaceId, rows] of constructorByWorkspace.entries()) {
      const pointed = rows.find((x) => x.isCurrent);
      const keep = pointed ?? pickLatestByNumber(rows, "versionNumber");
      constructorKeepByWorkspace.set(workspaceId, keep.id);
      plan.constructorVersions.keepIds.add(keep.id);
      for (const row of rows) {
        if (row.id !== keep.id) plan.constructorVersions.deleteIds.push(row.id);
      }
    }
  }

  // Pricing versions
  const pricingKeep = new Map();
  if (plan.available.pricingSession && plan.available.pricingVersion) {
    const sessions = await tx.pricingSession.findMany({
      select: { id: true, activeVersionId: true },
    });
    const pricingVersions = await tx.pricingVersion.findMany({
      select: {
        id: true,
        pricingSessionId: true,
        versionNumber: true,
        createdAt: true,
      },
    });
    const pricingBySession = groupBy(pricingVersions, "pricingSessionId");
    for (const s of sessions) {
      const rows = pricingBySession.get(s.id) ?? [];
      if (rows.length === 0) continue;
      const pointed = s.activeVersionId
        ? rows.find((x) => x.id === s.activeVersionId)
        : null;
      const keep = pointed ?? pickLatestByNumber(rows, "versionNumber");
      pricingKeep.set(s.id, keep.id);
      plan.pricingVersions.keepIds.add(keep.id);
      for (const row of rows) {
        if (row.id !== keep.id) plan.pricingVersions.deleteIds.push(row.id);
      }
    }
  }

  return {
    ...plan,
    contractKeep,
    constructorKeepByWorkspace,
    pricingKeep,
  };
}

function printSummary(plan) {
  console.log("=== CLEANUP PLAN ===");
  console.log("Tables available:", plan.available);
  console.log("Estimates to delete:", plan.estimates.deleteIds.length);
  console.log("Lead proposals to delete:", plan.leadProposals.deleteIds.length);
  console.log("Deal contract versions to delete:", plan.dealContractVersions.deleteIds.length);
  console.log("Constructor versions to delete:", plan.constructorVersions.deleteIds.length);
  console.log("Pricing versions to delete:", plan.pricingVersions.deleteIds.length);
}

async function applyPlan(tx, plan) {
  // Keep pointers on latest/current versions first.
  if (plan.available.dealContract && plan.available.dealContractVersion) {
    for (const [contractId, keep] of plan.contractKeep.entries()) {
      const updated = await tx.dealContract.updateMany({
        where: { id: contractId, currentVersionId: { not: keep.id } },
        data: {
          currentVersionId: keep.id,
          version: keep.revision,
        },
      });
      plan.pointerUpdates.contractsCurrentVersion += updated.count;
    }
  }

  if (plan.available.constructorVersion) {
    for (const [workspaceId, keepVersionId] of plan.constructorKeepByWorkspace.entries()) {
      const reset = await tx.constructorVersion.updateMany({
        where: { workspaceId, isCurrent: true, id: { not: keepVersionId } },
        data: { isCurrent: false },
      });
      plan.pointerUpdates.constructorCurrentReset += reset.count;
      const set = await tx.constructorVersion.updateMany({
        where: { id: keepVersionId, isCurrent: false },
        data: { isCurrent: true },
      });
      plan.pointerUpdates.constructorCurrentSet += set.count;
    }
  }

  if (plan.available.pricingSession && plan.available.pricingVersion) {
    for (const [sessionId, keepVersionId] of plan.pricingKeep.entries()) {
      const updated = await tx.pricingSession.updateMany({
        where: { id: sessionId, activeVersionId: { not: keepVersionId } },
        data: { activeVersionId: keepVersionId },
      });
      plan.pointerUpdates.pricingSessionsActiveVersion += updated.count;
    }
  }

  // Lead pointers should point to kept rows.
  if (plan.available.estimate && plan.available.lead) {
    const keepEstimates = await tx.estimate.findMany({
      where: { id: { in: [...plan.estimates.keepIds] } },
      select: { id: true, leadId: true, isActive: true },
    });
    const keepEstimateByLead = new Map(
      keepEstimates.filter((x) => x.leadId).map((x) => [x.leadId, x.id]),
    );
    for (const [leadId, estimateId] of keepEstimateByLead.entries()) {
      const updated = await tx.lead.updateMany({
        where: { id: leadId, activeEstimateId: { not: estimateId } },
        data: { activeEstimateId: estimateId },
      });
      plan.pointerUpdates.leadsActiveEstimate += updated.count;
    }
  }
  if (plan.available.estimate) {
    await tx.estimate.updateMany({
      where: { id: { in: [...plan.estimates.keepIds] } },
      data: { isActive: true },
    });
  }
  if (plan.available.estimate && plan.estimates.deleteIds.length > 0) {
    await tx.estimate.updateMany({
      where: { id: { in: plan.estimates.deleteIds } },
      data: { isActive: false },
    });
  }

  if (plan.available.leadProposal && plan.available.lead) {
    const keepProposals = await tx.leadProposal.findMany({
      where: { id: { in: [...plan.leadProposals.keepIds] } },
      select: { id: true, leadId: true },
    });
    for (const p of keepProposals) {
      const updated = await tx.lead.updateMany({
        where: { id: p.leadId, activeProposalId: { not: p.id } },
        data: { activeProposalId: p.id },
      });
      plan.pointerUpdates.leadsActiveProposal += updated.count;
    }
  }

  // Then delete old versions.
  if (plan.available.pricingVersion && plan.pricingVersions.deleteIds.length > 0) {
    await tx.pricingVersion.deleteMany({
      where: { id: { in: plan.pricingVersions.deleteIds } },
    });
  }
  if (plan.available.constructorVersion && plan.constructorVersions.deleteIds.length > 0) {
    await tx.constructorVersion.deleteMany({
      where: { id: { in: plan.constructorVersions.deleteIds } },
    });
  }
  if (plan.available.dealContractVersion && plan.dealContractVersions.deleteIds.length > 0) {
    await tx.dealContractVersion.deleteMany({
      where: { id: { in: plan.dealContractVersions.deleteIds } },
    });
  }
  if (plan.available.leadProposal && plan.leadProposals.deleteIds.length > 0) {
    await tx.leadProposal.deleteMany({
      where: { id: { in: plan.leadProposals.deleteIds } },
    });
  }
  if (plan.available.estimate && plan.estimates.deleteIds.length > 0) {
    await tx.estimate.deleteMany({
      where: { id: { in: plan.estimates.deleteIds } },
    });
  }
}

try {
  const plan = await prisma.$transaction(async (tx) => buildPlan(tx));
  printSummary(plan);

  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to execute deletion.");
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    await applyPlan(tx, plan);
  });

  console.log("=== APPLY DONE ===");
  console.log("Pointer updates:", plan.pointerUpdates);
} catch (error) {
  console.error("Cleanup failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
  await pool.end();
}
