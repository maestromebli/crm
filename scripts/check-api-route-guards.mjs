import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const API_ROOT = path.join(ROOT, "src", "app", "api");
const STRICT = process.argv.includes("--strict");

const PUBLIC_ROUTE_PATTERNS = [
  /\/api\/auth\//,
  /\/api\/health\/route\.ts$/,
  /\/api\/debug\/auth-status\/route\.ts$/,
  /\/api\/public\//,
  /\/api\/p\/\[token\]\//,
  /\/api\/c\/\[token\]\//,
  /\/api\/constructor\/\[token\]\//,
  /\/api\/internal\/cron\//,
  /\/api\/portal\/contracts\/\[token\]\//,
  /\/api\/client\/\[token\]\//,
  /\/api\/integrations\/.+\/webhook\//,
  /\/api\/webhooks\//,
];

const AUTH_GUARD_PATTERNS = [
  /require[A-Za-z0-9_]*(Session|Auth|Access|Scope|Permission|Token|ApiKey)[A-Za-z0-9_]*\s*\(/,
  /forbidUnless[A-Za-z0-9_]*\s*\(/,
  /hasEffectivePermission\s*\(/,
  /getServerSession\s*\(/,
  /resolveEffectiveUserFromJwt\s*\(/,
  /authorized\s*\(\s*req\s*\)/,
  /verifyWebhookSecret\s*\(/,
  /verifySecret\s*\(/,
  /verifyMetaSignature\s*\(/,
];

function toPosix(filePath) {
  return filePath.replaceAll("\\", "/");
}

function isPublicRoute(routePath) {
  return PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(routePath));
}

function hasAuthGuard(content) {
  return AUTH_GUARD_PATTERNS.some((pattern) => pattern.test(content));
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(fullPath)));
      continue;
    }
    if (entry.name === "route.ts") out.push(fullPath);
  }
  return out;
}

async function main() {
  const routeFiles = await walk(API_ROOT);
  const violations = [];

  for (const filePath of routeFiles) {
    const normalized = toPosix(filePath);
    if (isPublicRoute(normalized)) continue;
    const content = await readFile(filePath, "utf8");
    if (!hasAuthGuard(content)) {
      violations.push(normalized);
    }
  }

  if (violations.length === 0) {
    console.log("[security:route-guards] all API routes have auth guards or are public allowlisted");
    return;
  }

  console.log(`[security:route-guards] missing auth guard in ${violations.length} route(s):`);
  for (const filePath of violations) {
    const relative = toPosix(path.relative(ROOT, filePath));
    console.log(`- ${relative}`);
  }

  if (STRICT) {
    process.exitCode = 1;
  } else {
    console.log(
      "[security:route-guards] run with --strict to fail CI (currently warning mode)",
    );
  }
}

main().catch((error) => {
  console.error("[security:route-guards] failed", error);
  process.exitCode = 1;
});
