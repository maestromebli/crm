import { NextResponse } from "next/server";
import {
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../lib/authz/api-guard";
import { P } from "../../../../lib/authz/permissions";
import {
  getCommunicationsConfigSafe,
  upsertCommunicationsConfig,
} from "../../../../lib/settings/communications-settings-store";
import type { CommunicationsIntegrationsConfig } from "../../../../lib/settings/communications-config";

export const runtime = "nodejs";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_VIEW);
  if (denied) return denied;

  try {
    const data = await getCommunicationsConfigSafe();
    return NextResponse.json(data);
  } catch (e) {
     
    console.error("[GET settings/communications]", e);
    return NextResponse.json(
      { error: "Не вдалося завантажити налаштування" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Очікується об'єкт полів" }, { status: 400 });
  }

  const patch = body as Partial<CommunicationsIntegrationsConfig>;

  try {
    await upsertCommunicationsConfig(patch, user.id);
    const data = await getCommunicationsConfigSafe();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
     
    console.error("[PATCH settings/communications]", e);
    return NextResponse.json(
      { error: "Не вдалося зберегти налаштування" },
      { status: 500 },
    );
  }
}
