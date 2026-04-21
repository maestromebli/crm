import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { createOrForkLeadEstimateFromDraft } from "@/lib/estimates/create-lead-estimate-from-draft";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
} from "@/lib/prisma";
import { parseExcelWorkbook } from "@/features/calculation-import/parser/excelParser";
import { mapImportedWorkbookToDraftLines } from "@/features/calculation-import/mappers/mapToCalculationModel";
import type { ImportedWorkbook } from "@/features/calculation-import/types/calculationImport.types";

type Ctx = { params: Promise<{ leadId: string }> };

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
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const estDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
  if (estDenied) return estDenied;

  const { leadId } = await ctx.params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, ownerId: true, dealId: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });
  }
  if (lead.dealId) {
    return NextResponse.json(
      { error: "Лід уже привʼязаний до замовлення — прорахунки ведуться в замовленні" },
      { status: 409 },
    );
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  if (!prismaCodegenIncludesEstimateLeadId()) {
    return NextResponse.json(
      {
        error:
          "Застарілий Prisma Client. Виконайте `pnpm prisma generate` і перезапустіть dev-сервер.",
      },
      { status: 503 },
    );
  }

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
        {
          error: "Не вдалося розпізнати позиції в Excel",
          details: mapped.missing.join("; "),
        },
        { status: 400 },
      );
    }

    const sourceName =
      typeof body.sourceFileName === "string" && body.sourceFileName.trim()
        ? body.sourceFileName.trim()
        : body.workbook.fileName;

    const created = await prisma.$transaction(async (tx) =>
      createOrForkLeadEstimateFromDraft(tx, {
        leadId,
        userId: user.id,
        draftLines: mapped.lines,
        templateKey: null,
        changeSummary: `Excel імпорт: ${sourceName}`.slice(0, 500),
        notes: mapped.assumptions.join("\n"),
      }),
    );

    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads/${leadId}/estimate/${created.id}`);
    revalidatePath(`/leads/${leadId}/files`);

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

  const mime = file.type.toLowerCase();
  const isExcel =
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    file.name.toLowerCase().endsWith(".xlsx") ||
    file.name.toLowerCase().endsWith(".xls");
  if (!isExcel) {
    return NextResponse.json(
      { error: "Підтримується лише Excel (.xlsx/.xls)" },
      { status: 400 },
    );
  }

  const workbook = parseExcelWorkbook({
    fileBuffer: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
  });
  const mapped = mapImportedWorkbookToDraftLines(workbook);
  const isPreview = form.get("preview") === "1";
  if (isPreview) {
    return NextResponse.json({
      ok: true,
      workbook,
      lineCount: mapped.lines.length,
    });
  }

  if (mapped.lines.length === 0) {
    return NextResponse.json(
      {
        error: "Не вдалося розпізнати позиції в Excel",
        details: mapped.missing.join("; "),
      },
      { status: 400 },
    );
  }

  const created = await prisma.$transaction(async (tx) =>
    createOrForkLeadEstimateFromDraft(tx, {
      leadId,
      userId: user.id,
      draftLines: mapped.lines,
      templateKey: null,
      changeSummary: `Excel імпорт: ${file.name}`.slice(0, 500),
      notes: mapped.assumptions.join("\n"),
    }),
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/leads/${leadId}/estimate/${created.id}`);
  revalidatePath(`/leads/${leadId}/files`);

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
