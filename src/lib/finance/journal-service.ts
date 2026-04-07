import { Buffer } from "node:buffer";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const journalEntryInclude = {
  lines: { include: { ledgerAccount: true } },
  deal: { select: { id: true, title: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

export type JournalEntryWithRelations = Prisma.FinanceJournalEntryGetPayload<{
  include: typeof journalEntryInclude;
}>;

function encodeCursor(p: { postedAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ postedAt: p.postedAt.toISOString(), id: p.id }),
    "utf8",
  ).toString("base64url");
}

function decodeCursor(s: string): { postedAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const j = JSON.parse(raw) as { postedAt?: string; id?: string };
    if (typeof j.postedAt !== "string" || typeof j.id !== "string") return null;
    const postedAt = new Date(j.postedAt);
    if (Number.isNaN(postedAt.getTime())) return null;
    return { postedAt, id: j.id };
  } catch {
    return null;
  }
}

export type JournalLineInput = {
  ledgerAccountId: string;
  debitAmount?: number;
  creditAmount?: number;
  lineMemo?: string | null;
};

function validateLines(lines: JournalLineInput[]): void {
  if (lines.length < 2) {
    throw new Error("Проводка має містити щонайменше 2 рядки");
  }
  let sumD = new Prisma.Decimal(0);
  let sumC = new Prisma.Decimal(0);
  for (const l of lines) {
    const d = new Prisma.Decimal(l.debitAmount ?? 0);
    const c = new Prisma.Decimal(l.creditAmount ?? 0);
    if (d.gt(0) && c.gt(0)) {
      throw new Error("Рядок не може мати одночасно дебет і кредит");
    }
    if (d.lt(0) || c.lt(0)) {
      throw new Error("Суми не можуть бути від'ємними");
    }
    sumD = sumD.add(d);
    sumC = sumC.add(c);
  }
  if (!sumD.equals(sumC)) {
    throw new Error("Дебет і кредит проводки не збігаються");
  }
  if (sumD.equals(0)) {
    throw new Error("Сума проводки не може бути нульовою");
  }
}

export async function listLedgerAccounts() {
  return prisma.ledgerAccount.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });
}

export async function createJournalEntry(args: {
  dealId?: string | null;
  postedAt: Date;
  memo?: string | null;
  status: "DRAFT" | "POSTED";
  lines: JournalLineInput[];
  createdById: string | null;
}) {
  validateLines(args.lines);
  return prisma.$transaction(async (tx) => {
    const entry = await tx.financeJournalEntry.create({
      data: {
        dealId: args.dealId ?? undefined,
        postedAt: args.postedAt,
        status: args.status,
        memo: args.memo ?? undefined,
        createdById: args.createdById ?? undefined,
        lines: {
          create: args.lines.map((l) => ({
            ledgerAccountId: l.ledgerAccountId,
            debitAmount: l.debitAmount ?? 0,
            creditAmount: l.creditAmount ?? 0,
            lineMemo: l.lineMemo ?? undefined,
          })),
        },
      },
      include: journalEntryInclude,
    });
    return entry;
  });
}

export async function listJournalEntries(opts: {
  dealId?: string;
  take?: number;
  cursor?: string | null;
}): Promise<{ entries: JournalEntryWithRelations[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(opts.take ?? 25, 1), 100);
  const baseWhere: Prisma.FinanceJournalEntryWhereInput = opts.dealId
    ? { dealId: opts.dealId }
    : {};

  let where: Prisma.FinanceJournalEntryWhereInput = baseWhere;
  if (opts.cursor?.trim()) {
    const c = decodeCursor(opts.cursor.trim());
    if (!c) {
      throw new Error("Некоректний cursor");
    }
    const cursorWhere: Prisma.FinanceJournalEntryWhereInput = {
      OR: [
        { postedAt: { lt: c.postedAt } },
        { AND: [{ postedAt: c.postedAt }, { id: { lt: c.id } }] },
      ],
    };
    where = { AND: [baseWhere, cursorWhere] };
  }

  const rows = await prisma.financeJournalEntry.findMany({
    where,
    orderBy: [{ postedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    include: journalEntryInclude,
  });

  const hasMore = rows.length > take;
  const entries = hasMore ? rows.slice(0, take) : rows;
  const last = entries[entries.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ postedAt: last.postedAt, id: last.id }) : null;

  return { entries, nextCursor };
}

export async function voidJournalEntry(args: { entryId: string; actorUserId: string }) {
  const current = await prisma.financeJournalEntry.findUnique({
    where: { id: args.entryId },
    select: { id: true, status: true, dealId: true },
  });
  if (!current) {
    throw new Error("Проводку не знайдено");
  }
  if (current.status !== "POSTED") {
    throw new Error("Можна скасувати лише проведену проводку (POSTED)");
  }
  await prisma.$transaction([
    prisma.financeJournalEntry.update({
      where: { id: args.entryId },
      data: { status: "VOIDED" },
    }),
    prisma.activityLog.create({
      data: {
        entityType: "FINANCE",
        entityId: args.entryId,
        type: "FINANCE_JOURNAL_VOIDED",
        actorUserId: args.actorUserId,
        source: "USER",
        data: { dealId: current.dealId },
      },
    }),
  ]);
}

export async function logJournalPostedAudit(args: {
  entryId: string;
  actorUserId: string;
  dealId: string | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        entityType: "FINANCE",
        entityId: args.entryId,
        type: "FINANCE_JOURNAL_POSTED",
        actorUserId: args.actorUserId,
        source: "USER",
        data: { dealId: args.dealId },
      },
    });
  } catch (e) {
    console.error("[logJournalPostedAudit]", e);
  }
}
