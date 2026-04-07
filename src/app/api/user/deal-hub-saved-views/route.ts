import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../lib/authz/api-guard";
import {
  createDealHubSavedView,
  listDealHubSavedViewsForUser,
} from "../../../../features/deal-hub/deal-hub-saved-views";
import { dealHubFiltersSchema } from "../../../../features/deal-hub/deal-hub-filters";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано", views: [] },
      { status: 503 },
    );
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const views = await listDealHubSavedViewsForUser(user.id);
  return NextResponse.json({ views });
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  let body: { name?: unknown; filters?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; filters?: unknown };
  } catch {
    return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const parsed = dealHubFiltersSchema.safeParse(body.filters);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некоректні фільтри" }, { status: 400 });
  }

  const result = await createDealHubSavedView({
    userId: user.id,
    name,
    filters: parsed.data,
  });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
