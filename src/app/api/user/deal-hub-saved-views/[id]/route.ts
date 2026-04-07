import { NextResponse } from "next/server";
import { requireSessionUser } from "../../../../../lib/authz/api-guard";
import { deleteDealHubSavedView } from "../../../../../features/deal-hub/deal-hub-saved-views";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const result = await deleteDealHubSavedView({ userId: user.id, id });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
