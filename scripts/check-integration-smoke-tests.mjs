import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SETTINGS_INTEGRATIONS_ROOT = path.join(
  ROOT,
  "src",
  "app",
  "(dashboard)",
  "settings",
  "integrations",
);
const API_INTEGRATIONS_ROOT = path.join(ROOT, "src", "app", "api", "integrations");
const REQUIRED_TEST_PAGES = [
  {
    pagePath: path.join(ROOT, "src", "app", "(dashboard)", "settings", "ai", "page.tsx"),
    routePath: path.join(ROOT, "src", "app", "api", "integrations", "ai", "route.ts"),
    endpointLiteral: "/api/integrations/ai",
    label: "ai-settings",
  },
  {
    pagePath: path.join(
      ROOT,
      "src",
      "app",
      "(dashboard)",
      "settings",
      "communications",
      "page.tsx",
    ),
    routePath: path.join(
      ROOT,
      "src",
      "app",
      "api",
      "integrations",
      "telegram",
      "route.ts",
    ),
    endpointLiteral: "/api/integrations/telegram",
    label: "communications-telegram",
  },
  {
    pagePath: path.join(
      ROOT,
      "src",
      "app",
      "(dashboard)",
      "settings",
      "communications",
      "page.tsx",
    ),
    routePath: path.join(
      ROOT,
      "src",
      "app",
      "api",
      "integrations",
      "whatsapp",
      "route.ts",
    ),
    endpointLiteral: "/api/integrations/whatsapp",
    label: "communications-whatsapp",
  },
  {
    pagePath: path.join(
      ROOT,
      "src",
      "app",
      "(dashboard)",
      "settings",
      "communications",
      "page.tsx",
    ),
    routePath: path.join(
      ROOT,
      "src",
      "app",
      "api",
      "integrations",
      "instagram",
      "route.ts",
    ),
    endpointLiteral: "/api/integrations/instagram",
    label: "communications-instagram",
  },
  {
    pagePath: path.join(
      ROOT,
      "src",
      "app",
      "(dashboard)",
      "settings",
      "communications",
      "page.tsx",
    ),
    routePath: path.join(
      ROOT,
      "src",
      "app",
      "api",
      "integrations",
      "viber",
      "route.ts",
    ),
    endpointLiteral: "/api/integrations/viber",
    label: "communications-viber",
  },
  {
    pagePath: path.join(
      ROOT,
      "src",
      "app",
      "(dashboard)",
      "settings",
      "communications",
      "page.tsx",
    ),
    routePath: path.join(
      ROOT,
      "src",
      "app",
      "api",
      "integrations",
      "sms",
      "route.ts",
    ),
    endpointLiteral: "/api/integrations/sms",
    label: "communications-sms",
  },
  {
    pagePath: path.join(
      ROOT,
      "src",
      "app",
      "(dashboard)",
      "settings",
      "communications",
      "page.tsx",
    ),
    routePath: path.join(
      ROOT,
      "src",
      "app",
      "api",
      "integrations",
      "phone",
      "route.ts",
    ),
    endpointLiteral: "/api/integrations/phone",
    label: "communications-phone",
  },
];

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getIntegrationSlugs() {
  const entries = await readdir(SETTINGS_INTEGRATIONS_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const slugs = await getIntegrationSlugs();
  const violations = [];

  for (const slug of slugs) {
    const pagePath = path.join(SETTINGS_INTEGRATIONS_ROOT, slug, "page.tsx");
    const routePath = path.join(API_INTEGRATIONS_ROOT, slug, "route.ts");
    const endpointLiteral = `/api/integrations/${slug}`;

    const [hasPage, hasRoute] = await Promise.all([
      pathExists(pagePath),
      pathExists(routePath),
    ]);

    if (!hasPage) {
      violations.push(
        `slug "${slug}": отсутствует страница настроек ${path.relative(ROOT, pagePath)}`,
      );
      continue;
    }

    if (!hasRoute) {
      violations.push(
        `slug "${slug}": отсутствует API mini-test ${path.relative(ROOT, routePath)}`,
      );
      continue;
    }

    const pageContent = await readFile(pagePath, "utf8");
    if (!pageContent.includes(endpointLiteral)) {
      violations.push(
        `slug "${slug}": страница ${path.relative(ROOT, pagePath)} не ссылается на ${endpointLiteral}`,
      );
    }
  }

  for (const item of REQUIRED_TEST_PAGES) {
    const [hasPage, hasRoute] = await Promise.all([
      pathExists(item.pagePath),
      pathExists(item.routePath),
    ]);
    if (!hasPage) {
      violations.push(
        `${item.label}: отсутствует страница ${path.relative(ROOT, item.pagePath)}`,
      );
      continue;
    }
    if (!hasRoute) {
      violations.push(
        `${item.label}: отсутствует API mini-test ${path.relative(ROOT, item.routePath)}`,
      );
      continue;
    }
    const content = await readFile(item.pagePath, "utf8");
    if (!content.includes(item.endpointLiteral)) {
      violations.push(
        `${item.label}: страница ${path.relative(ROOT, item.pagePath)} не ссылается на ${item.endpointLiteral}`,
      );
    }
  }

  if (violations.length === 0) {
    console.log("[quality:integration-smoke] all integration settings have mini-tests");
    return;
  }

  console.error(
    `[quality:integration-smoke] found ${violations.length} violation(s):`,
  );
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error("[quality:integration-smoke] failed", error);
  process.exitCode = 1;
});
