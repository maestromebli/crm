import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../../lib/authz/api-guard";
import {
  getUserCommunicationsConfigSafe,
  upsertUserCommunicationsConfig,
} from "../../../../../lib/settings/communications-settings-store";
import type { CommunicationsIntegrationsConfig } from "../../../../../lib/settings/communications-config";

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

  try {
    const data = await getUserCommunicationsConfigSafe(user.id);
    return NextResponse.json(data);
  } catch (e) {
     
    console.error("[GET settings/communications/me]", e);
    return NextResponse.json(
      { error: "Не вдалося завантажити персональні налаштування" },
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
    await upsertUserCommunicationsConfig(user.id, patch, user.id);
    const data = await getUserCommunicationsConfigSafe(user.id);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
     
    console.error("[PATCH settings/communications/me]", e);
    return NextResponse.json(
      { error: "Не вдалося зберегти персональні налаштування" },
      { status: 500 },
    );
  }
}
