import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

const OUT_DIR = path.join(
  process.cwd(),
  "docs",
  "site-restoration",
  "screenshots",
  "lead-pricing",
);

const IGNORE_LEADS_HREFS = new Set([
  "/leads",
  "/leads/new",
  "/leads/no-response",
  "/leads/mine",
  "/leads/overdue",
  "/leads/duplicates",
  "/leads/re-contact",
  "/leads/converted",
  "/leads/unassigned",
  "/leads/qualified",
  "/leads/lost",
  "/leads/closed",
  "/leads/archived",
  "/leads/sources",
  "/leads/pipeline",
]);

test.describe.configure({ mode: "serial" });
test.setTimeout(6 * 60 * 1000);

test("capture lead pricing workflow screenshots", async ({ page }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest: {
    capturedAt: string;
    files: { file: string; href: string; note: string }[];
  } = {
    capturedAt: new Date().toISOString(),
    files: [],
  };

  let index = 0;
  async function shot(href: string, note: string) {
    index += 1;
    const file = `${String(index).padStart(3, "0")}_${note.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    await page.goto(href, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(OUT_DIR, file),
      fullPage: true,
    });
    manifest.files.push({ file, href, note });
  }

  const email = process.env.SCREENSHOT_EMAIL ?? "admin@enver.com";
  const password = process.env.SCREENSHOT_PASSWORD ?? "admin123";
  const csrfRes = await page.request.get("/api/auth/csrf");
  expect(csrfRes.ok()).toBeTruthy();
  const csrf = (await csrfRes.json()) as { csrfToken?: string };
  expect(csrf.csrfToken).toBeTruthy();
  const body = new URLSearchParams({
    csrfToken: String(csrf.csrfToken),
    email,
    password,
    callbackUrl: "/crm/dashboard",
    json: "true",
  });
  const signInRes = await page.request.post("/api/auth/callback/credentials", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: body.toString(),
  });
  expect(signInRes.ok(), await signInRes.text()).toBeTruthy();
  await page.goto("/crm/dashboard", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page).toHaveURL(/\/(crm\/dashboard|dashboard)/);

  await page.goto("/leads", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(600);

  let leadHref = process.env.SCREENSHOT_LEAD_HREF?.trim() ?? "";
  if (!leadHref) {
    const leadLinks = page.locator('a[href^="/leads/"]');
    const count = await leadLinks.count();
    for (let i = 0; i < count; i += 1) {
      const href = (await leadLinks.nth(i).getAttribute("href"))?.trim() ?? "";
      if (!href) continue;
      if (!/^\/leads\/[^/?#]+$/.test(href)) continue;
      if (IGNORE_LEADS_HREFS.has(href)) continue;
      leadHref = href;
      break;
    }
  }
  expect(leadHref).toBeTruthy();
  const baseLeadHref = String(leadHref);

  await shot(baseLeadHref, "lead_overview");
  await shot(`${baseLeadHref}/pricing`, "lead_pricing");
  await shot(`${baseLeadHref}/kp`, "lead_kp");

  let estimateHref: string | null = null;
  const estimateLinks = page.locator('a[href*="/estimate/"]');
  const estimateCount = await estimateLinks.count();
  for (let i = 0; i < estimateCount; i += 1) {
    const href = (await estimateLinks.nth(i).getAttribute("href"))?.trim() ?? "";
    if (!href) continue;
    if (/^\/leads\/[^/]+\/estimate\/[^/]+$/.test(href)) {
      estimateHref = href;
      break;
    }
  }

  if (estimateHref) {
    await shot(String(estimateHref), "lead_estimate_detail");

    let versionPreviewHref: string | null = null;
    const versionLinks = page.locator('a[href*="version-preview"]');
    const versionCount = await versionLinks.count();
    for (let i = 0; i < versionCount; i += 1) {
      const href = (await versionLinks.nth(i).getAttribute("href"))?.trim() ?? "";
      if (!href) continue;
      if (/version-preview/.test(href)) {
        versionPreviewHref = href;
        break;
      }
    }
    if (versionPreviewHref) {
      await shot(String(versionPreviewHref), "lead_estimate_version_preview");
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
});
