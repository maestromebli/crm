import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canFinanceAction } from "@/features/finance/lib/permissions";
import { listLedgerAccounts } from "@/lib/finance/journal-service";

export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canFinanceAction(user, "finance.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }
    const rows = await listLedgerAccounts();
    return NextResponse.json({
      accounts: rows.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        kind: a.kind,
        sortOrder: a.sortOrder,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Помилка сервера";
    console.error("[GET ledger-accounts]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
