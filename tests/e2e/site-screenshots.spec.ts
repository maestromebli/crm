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
test.setTimeout(45 * 60 * 1000);

const MAX_LINKS_PER_PAGE = 10;
const MAX_BUTTONS_PER_PAGE = 8;
const SLOW_ROUTE_TIMEOUTS_MS: Record<string, number> = {
  "/leads/new": 120_000,
};

function isTransientInteractionError(message: string): boolean {
  return /Target page, context or browser has been closed|Protocol error|Execution context was destroyed|Cannot find context with specified id|Element is not attached|Frame was detached/i.test(
    message,
  );
}

test("site screenshots for restoration", async ({ page, baseURL }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: {
    capturedAt: string;
    baseURL: string;
    files: { file: string; href: string; label: string; group: string }[];
    errors: { href: string; message: string }[];
    buttonErrors: { href: string; button: string; message: string }[];
  } = {
    capturedAt: new Date().toISOString(),
    baseURL: baseURL ?? "",
    files: [],
    errors: [],
    buttonErrors: [],
  };

  let index = 0;

  async function waitForServerReady() {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        const probe = await page.request.get("/login", { timeout: 20_000 });
        if (probe.ok()) return;
      } catch {
        // ignore transient boot/restart failures
      }
      await page.waitForTimeout(1_000 * attempt);
    }
  }

  async function gotoWithRetry(href: string, timeout = 45_000) {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        await waitForServerReady();
        await page.goto(href, { waitUntil: "domcontentloaded", timeout });
        return;
      } catch (e) {
        lastError = e;
        await page.waitForTimeout(1_000 * attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async function auditInteractions(currentHref: string) {
    const internalLinks = page.locator('a[href^="/"]');
    const linkCount = Math.min(await internalLinks.count(), MAX_LINKS_PER_PAGE);
    const seenLinks = new Set<string>();

    for (let i = 0; i < linkCount; i += 1) {
      const href = (await internalLinks.nth(i).getAttribute("href"))?.trim();
      if (!href || href.startsWith("/api/") || href.startsWith("/auth/")) continue;
      if (seenLinks.has(href)) continue;
      seenLinks.add(href);
      try {
        const res = await page.request.get(href, { timeout: 20_000 });
        if (res.status() >= 400) {
          manifest.errors.push({ href: `${currentHref} -> ${href}`, message: `HTTP ${res.status()}` });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // Dev server can temporarily restart under heavy compile load.
        if (/ECONNREFUSED|ECONNRESET|Timeout/i.test(message)) continue;
        manifest.errors.push({ href: `${currentHref} -> ${href}`, message });
      }
    }

    const buttons = page.locator("main button");
    const buttonCount = Math.min(await buttons.count(), MAX_BUTTONS_PER_PAGE);
    for (let i = 0; i < buttonCount; i += 1) {
      const button = buttons.nth(i);
      if (!(await button.isVisible()) || !(await button.isEnabled())) continue;
      const buttonLabel =
        (await button.innerText().catch(() => "")) ||
        (await button.getAttribute("aria-label").catch(() => "")) ||
        `button#${i + 1}`;
      if (/розгорнути підменю|згорнути підменю/i.test(buttonLabel)) continue;
      let failedMessage: string | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          await button.scrollIntoViewIfNeeded();
          // trial mode перевіряє, що кнопка реально клікабельна без side-effects.
          await button.click({ trial: true, timeout: 5_000 });
          failedMessage = null;
          break;
        } catch (e) {
          failedMessage = e instanceof Error ? e.message : String(e);
          if (isTransientInteractionError(failedMessage)) {
            await page.waitForTimeout(150 * attempt);
            failedMessage = null;
            break;
          }
          if (attempt < 2) {
            await page.waitForTimeout(150 * attempt);
          }
        }
      }
      if (failedMessage) {
        manifest.buttonErrors.push({
          href: currentHref,
          button: buttonLabel.trim().slice(0, 120),
          message: failedMessage,
        });
      }
    }
  }

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
      let success = false;
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        try {
          await waitForServerReady();
          const routeTimeout = SLOW_ROUTE_TIMEOUTS_MS[href] ?? 60_000;
          const res = await page.goto(href, {
            waitUntil: "domcontentloaded",
            timeout: routeTimeout,
          });
          if (res && res.status() >= 400) {
            manifest.errors.push({ href, message: `HTTP ${res.status()}` });
            return;
          }
          await page.waitForTimeout(200);
          await page.screenshot({
            path: filePath,
            fullPage: opts?.fullPage !== false,
          });
          await auditInteractions(href);
          manifest.files.push({ file: name, href, label, group });
          success = true;
          break;
        } catch (e) {
          lastError = e;
          await page.waitForTimeout(1_500 * attempt);
        }
      }
      if (!success) {
        throw lastError instanceof Error ? lastError : new Error(String(lastError));
      }
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
  const csrfRes = await page.request.get("/api/auth/csrf");
  const csrf = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfRes.ok() || !csrf.csrfToken) {
    throw new Error("Failed to fetch NextAuth CSRF token");
  }
  const authBody = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email,
    password,
    callbackUrl: "/crm/dashboard",
    json: "true",
  });
  const signInRes = await page.request.post("/api/auth/callback/credentials", {
    headers: { "content-type": "application/x-www-form-urlencoded" },
    data: authBody.toString(),
  });
  if (!signInRes.ok()) {
    throw new Error(`NextAuth credentials callback failed: ${await signInRes.text()}`);
  }
  await gotoWithRetry("/crm/dashboard", 60_000);
  await page.waitForURL(/\/(crm\/dashboard|dashboard)/, { timeout: 45_000 });

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
