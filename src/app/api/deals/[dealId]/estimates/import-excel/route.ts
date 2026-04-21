import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  forbidUnlessDealAccess,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";
import { parseExcelWorkbook } from "@/features/calculation-import/parser/excelParser";
import { mapImportedWorkbookToDraftLines } from "@/features/calculation-import/mappers/mapToCalculationModel";
import type { ImportedWorkbook } from "@/features/calculation-import/types/calculationImport.types";
import { createDealEstimateFromDraft } from "@/lib/estimates/create-deal-estimate-from-draft";

type Ctx = { params: Promise<{ dealId: string }> };

export const runtime = "nodejs";

function isImportedWorkbook(input: unknown): input is ImportedWorkbook {
  if (!input || typeof input !== "object") return false;
  const value = input as Record<string, unknown>;
  return (
    typeof value.fileName === "string" &&
    Array.isArray(value.sheets) &&
    typeof value.parsedAt === "string"
  );
}

export async function POST(req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { dealId } = await ctx.params;
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, ownerId: true },
  });
  if (!deal) {
    return NextResponse.json({ error: "Замовлення не знайдено" }, { status: 404 });
  }
  const denied = await forbidUnlessDealAccess(user, P.ESTIMATES_CREATE, deal);
  if (denied) return denied;

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      apply?: boolean;
      workbook?: unknown;
      sourceFileName?: string;
    };
    if (!body.apply || !isImportedWorkbook(body.workbook)) {
      return NextResponse.json({ error: "Некоректний payload" }, { status: 400 });
    }
    const mapped = mapImportedWorkbookToDraftLines(body.workbook);
    if (mapped.lines.length === 0) {
      return NextResponse.json(
        { error: "Не знайдено валідних рядків", details: mapped.missing.join("; ") },
        { status: 400 },
      );
    }

    const sourceName =
      typeof body.sourceFileName === "string" && body.sourceFileName.trim()
        ? body.sourceFileName.trim()
        : body.workbook.fileName;

    const created = await prisma.$transaction((tx) =>
      createDealEstimateFromDraft(tx, {
        dealId,
        userId: user.id,
        draftLines: mapped.lines,
        changeSummary: `Excel імпорт: ${sourceName}`.slice(0, 500),
        notes: mapped.assumptions.join("\n"),
      }),
    );
    revalidatePath(`/deals/${dealId}/workspace`);
    return NextResponse.json({
      ok: true,
      importedRows: mapped.lines.length,
      estimate: {
        id: created.id,
        version: created.version,
        totalPrice: created.totalPrice,
      },
    });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл не передано" }, { status: 400 });
  }

  const workbook = parseExcelWorkbook({
    fileBuffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
  });
  const mapped = mapImportedWorkbookToDraftLines(workbook);
  if (form.get("preview") === "1") {
    return NextResponse.json({ ok: true, workbook, lineCount: mapped.lines.length });
  }
  if (mapped.lines.length === 0) {
    return NextResponse.json(
      { error: "Не знайдено валідних рядків", details: mapped.missing.join("; ") },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction((tx) =>
    createDealEstimateFromDraft(tx, {
      dealId,
      userId: user.id,
      draftLines: mapped.lines,
      changeSummary: `Excel імпорт: ${file.name}`.slice(0, 500),
      notes: mapped.assumptions.join("\n"),
    }),
  );
  revalidatePath(`/deals/${dealId}/workspace`);
  return NextResponse.json({
    ok: true,
    importedRows: mapped.lines.length,
    estimate: {
      id: created.id,
      version: created.version,
      totalPrice: created.totalPrice,
    },
  });
}
