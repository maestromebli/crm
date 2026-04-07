import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "docs/core-v2/contract-manifest.json",
  "docs/core-v2/estimate-no-regression-checklist.md",
  "src/modules/estimate-workspace/DealEstimateWorkspace.tsx",
  "src/modules/estimate-workspace/useDealEstimateWorkspace.ts",
  "src/lib/estimates/serialize.ts",
  "src/lib/events/crm-events.ts",
  "src/app/api/leads/[leadId]/activity/route.ts",
  "src/app/api/deals/[dealId]/activity/route.ts",
];

async function ensureFile(file) {
  const absolute = path.join(root, file);
  await access(absolute);
  return absolute;
}

async function main() {
  for (const file of requiredFiles) {
    await ensureFile(file);
  }

  const manifestPath = path.join(root, "docs/core-v2/contract-manifest.json");
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw);

  if (!manifest?.policy?.calculationUxFrozen) {
    throw new Error("contract-manifest: policy.calculationUxFrozen must be true");
  }
  if (!Array.isArray(manifest?.eventContract?.mandatoryFamilies)) {
    throw new Error("contract-manifest: eventContract.mandatoryFamilies is required");
  }

  const expectedFamilies = [
    "lead_created",
    "status_changed",
    "file_uploaded",
    "estimate_created",
    "quote_sent",
    "payment_received",
  ];
  for (const family of expectedFamilies) {
    if (!manifest.eventContract.mandatoryFamilies.includes(family)) {
      throw new Error(`contract-manifest: missing mandatory family "${family}"`);
    }
  }

  console.log("[core-v2-verify] ok");
}

main().catch((error) => {
  console.error("[core-v2-verify] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
