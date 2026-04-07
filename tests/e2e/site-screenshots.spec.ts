/**
 * Знімки сторінок для відновлення/документації UI.
 * Вихід: docs/site-restoration/screenshots/
 *
 * pnpm screenshots:site
 *
 * Змінні: SCREENSHOT_EMAIL, SCREENSHOT_PASSWORD, SCREENSHOT_DEAL_ID (опційно),
 * SCREENSHOT_BASE_URL, SCREENSHOT_SKIP_SERVER=1 (якщо dev уже запущений).
 */
import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { NAV_SECTIONS } from "../../src/config/navigation";
import { SETTINGS_ITEMS } from "../../src/config/settings";
import { DEAL_WORKSPACE_TABS } from "../../src/components/deal-workspace/deal-workspace-tabs";

const OUT_DIR = path.join(
  process.cwd(),
  "docs",
  "site-restoration",
  "screenshots",
);

function slugifyPath(href: string): string {
  const s =
    href
      .replace(/^\//, "")
      .replace(/\//g, "__")
      .replace(/\?/g, "_")
      .replace(/=/g, "_")
      .replace(/&/g, "_") || "root";
  return s.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function collectUrls(): { href: string; label: string; group: string }[] {
  const rows: { href: string; label: string; group: string }[] = [];

  for (const section of NAV_SECTIONS) {
    rows.push({
      href: section.href,
      label: `${section.label} (корінь розділу)`,
      group: `nav:${section.id}`,
    });
    for (const sub of section.subItems ?? []) {
      rows.push({
        href: sub.href,
        label: `${section.label} → ${sub.label}`,
        group: `nav:${section.id}`,
      });
    }
  }

  for (const item of SETTINGS_ITEMS) {
    rows.push({
      href: item.path,
      label: `Налаштування → ${item.label}`,
      group: "settings",
    });
  }

  const skip = new Set(["/login"]);
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (skip.has(r.href)) return false;
    if (seen.has(r.href)) return false;
    seen.add(r.href);
    return true;
  });
}

test.describe.configure({ mode: "serial" });

test("site screenshots for restoration", async ({ page, baseURL }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: {
    capturedAt: string;
    baseURL: string;
    files: { file: string; href: string; label: string; group: string }[];
    errors: { href: string; message: string }[];
  } = {
    capturedAt: new Date().toISOString(),
    baseURL: baseURL ?? "",
    files: [],
    errors: [],
  };

  let index = 0;

  async function shot(
    href: string,
    label: string,
    group: string,
    opts?: { fullPage?: boolean },
  ) {
    index += 1;
    const name = `${String(index).padStart(3, "0")}_${slugifyPath(href)}.png`;
    const filePath = path.join(OUT_DIR, name);
    try {
      const res = await page.goto(href, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      if (res && res.status() >= 400) {
        manifest.errors.push({ href, message: `HTTP ${res.status()}` });
      }
      await page.waitForTimeout(500);
      await page.screenshot({
        path: filePath,
        fullPage: opts?.fullPage !== false,
      });
      manifest.files.push({ file: name, href, label, group });
    } catch (e) {
      manifest.errors.push({
        href,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /* До входу */
  await shot("/", "Корінь редирект (неавторизовано)", "system");
  await shot("/login", "Сторінка логіну", "system");

  const email = process.env.SCREENSHOT_EMAIL ?? "admin@enver.com";
  const password = process.env.SCREENSHOT_PASSWORD ?? "admin123";

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /увійти/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

  for (const row of collectUrls()) {
    await shot(row.href, row.label, row.group);
  }

  const dealId = process.env.SCREENSHOT_DEAL_ID?.trim();
  if (dealId) {
    for (const tab of DEAL_WORKSPACE_TABS) {
      const href = `/deals/${dealId}/workspace?tab=${tab.id}`;
      await shot(
        href,
        `Робоче місце угоди → ${tab.label}`,
        "deal-workspace",
      );
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );

  expect(manifest.files.length).toBeGreaterThan(5);
});
