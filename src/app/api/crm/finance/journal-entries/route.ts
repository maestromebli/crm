import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/authz/api-guard";
import { canFinanceAction } from "@/features/finance/lib/permissions";
import {
  createJournalEntry,
  listJournalEntries,
  logJournalPostedAudit,
  type JournalEntryWithRelations,
  type JournalLineInput,
} from "@/lib/finance/journal-service";
import { prisma } from "@/lib/prisma";

function serializeEntry(entry: JournalEntryWithRelations) {
  return {
    id: entry.id,
    dealId: entry.dealId,
    deal: entry.deal,
    postedAt: entry.postedAt.toISOString(),
    status: entry.status,
    memo: entry.memo,
    createdById: entry.createdById,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt.toISOString(),
    lines: entry.lines.map((l) => ({
      id: l.id,
      ledgerAccountId: l.ledgerAccountId,
      accountCode: l.ledgerAccount.code,
      accountName: l.ledgerAccount.name,
      debitAmount: l.debitAmount.toString(),
      creditAmount: l.creditAmount.toString(),
      lineMemo: l.lineMemo,
    })),
  };
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canFinanceAction(user, "finance.view")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get("dealId")?.trim() || undefined;
    const takeRaw = searchParams.get("take");
    const takeNum = takeRaw ? Number(takeRaw) : NaN;
    const take = takeRaw && Number.isFinite(takeNum) ? takeNum : undefined;
    const cursor = searchParams.get("cursor")?.trim() || undefined;
    const { entries: rows, nextCursor } = await listJournalEntries({ dealId, take, cursor });
    return NextResponse.json({ entries: rows.map(serializeEntry), nextCursor });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Помилка сервера";
    console.error("[GET journal-entries]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json({ error: "DATABASE_URL не задано" }, { status: 503 });
  }
  try {
    const user = await requireSessionUser();
    if (user instanceof NextResponse) return user;
    if (!canFinanceAction(user, "finance.transaction.create")) {
      return NextResponse.json({ error: "Недостатньо прав" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Некоректний JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Очікується об'єкт" }, { status: 400 });
    }
    const o = body as Record<string, unknown>;
    const dealIdRaw = o.dealId;
    const dealId =
      typeof dealIdRaw === "string" && dealIdRaw.trim() ? dealIdRaw.trim() : null;
    if (dealId) {
      const exists = await prisma.deal.findUnique({
        where: { id: dealId },
        select: { id: true },
      });
      if (!exists) {
        return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
      }
    }

    const postedAtRaw = o.postedAt;
    const postedAt =
      typeof postedAtRaw === "string" && postedAtRaw.trim()
        ? new Date(postedAtRaw)
        : new Date();
    if (Number.isNaN(postedAt.getTime())) {
      return NextResponse.json({ error: "postedAt некоректна дата" }, { status: 400 });
    }

    const statusRaw = typeof o.status === "string" ? o.status.trim().toUpperCase() : "POSTED";
    if (statusRaw !== "DRAFT" && statusRaw !== "POSTED") {
      return NextResponse.json({ error: "status має бути DRAFT або POSTED" }, { status: 400 });
    }

    const memo = typeof o.memo === "string" ? o.memo : null;
    const linesRaw = o.lines;
    if (!Array.isArray(linesRaw) || linesRaw.length < 2) {
      return NextResponse.json(
        { error: "lines має бути масивом з щонайменше 2 рядків" },
        { status: 400 },
      );
    }

    const lines: JournalLineInput[] = [];
    for (const row of linesRaw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const r = row as Record<string, unknown>;
      const ledgerAccountId =
        typeof r.ledgerAccountId === "string" ? r.ledgerAccountId.trim() : "";
      if (!ledgerAccountId) {
        return NextResponse.json({ error: "Кожен рядок має ledgerAccountId" }, { status: 400 });
      }
      const debitAmount =
        typeof r.debitAmount === "number"
          ? r.debitAmount
          : typeof r.debitAmount === "string"
            ? Number(r.debitAmount)
            : 0;
      const creditAmount =
        typeof r.creditAmount === "number"
          ? r.creditAmount
          : typeof r.creditAmount === "string"
            ? Number(r.creditAmount)
            : 0;
      if (!Number.isFinite(debitAmount) || !Number.isFinite(creditAmount)) {
        return NextResponse.json({ error: "Некоректні суми в рядку" }, { status: 400 });
      }
      lines.push({
        ledgerAccountId,
        debitAmount,
        creditAmount,
        lineMemo: typeof r.lineMemo === "string" ? r.lineMemo : null,
      });
    }

    if (lines.length < 2) {
      return NextResponse.json({ error: "Недостатньо коректних рядків проводки" }, { status: 400 });
    }

    const entry = await createJournalEntry({
      dealId,
      postedAt,
      memo,
      status: statusRaw,
      lines,
      createdById: user.id,
    });

    if (statusRaw === "POSTED") {
      await logJournalPostedAudit({
        entryId: entry.id,
        actorUserId: user.id,
        dealId,
      });
    }

    return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Помилка сервера";
    console.error("[POST journal-entries]", e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
