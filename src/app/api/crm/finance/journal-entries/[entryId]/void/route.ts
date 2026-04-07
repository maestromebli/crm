import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canFinanceAction } from "@/features/finance/lib/permissions";
import { voidJournalEntry } from "@/lib/finance/journal-service";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ entryId: string }> },
) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canFinanceAction(user, "finance.transaction.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }
    const { entryId } = await ctx.params;
    if (!entryId?.trim()) {
      return NextResponse.json({ error: "entryId обовʼязковий" }, { status: 400 });
    }
    await voidJournalEntry({ entryId: entryId.trim(), actorUserId: user.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Помилка сервера";
    const status = message.includes("не знайдено")
      ? 404
      : message.includes("Можна скасувати")
        ? 409
        : 400;
    console.error("[POST journal-entries void]", e);
    return NextResponse.json({ error: message }, { status });
  }
}
