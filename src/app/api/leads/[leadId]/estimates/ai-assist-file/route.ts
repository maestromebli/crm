import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "../../../../../../lib/authz/api-guard";
import { P } from "../../../../../../lib/authz/permissions";
import { analyzeEstimateFromContent } from "../../../../../../lib/estimates/ai-estimate-from-file";
import { buildEstimateDraftFromExcelBuffer } from "../../../../../../lib/estimates/import-estimate-excel";
import { extractTextFromBuffer } from "../../../../../../features/ai/file-intelligence/extract-local-buffer";
import { prisma } from "../../../../../../lib/prisma";

type Ctx = { params: Promise<{ leadId: string }> };

export const runtime = "nodejs";

function isExcelFile(name: string, mimeType: string): boolean {
  const n = name.toLowerCase();
  const m = mimeType.toLowerCase();
  return (
    m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    m === "application/vnd.ms-excel" ||
    n.endsWith(".xlsx") ||
    n.endsWith(".xls")
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
    return NextResponse.json({ error: "Використовуйте смету в замовленні" }, { status: 409 });
  }

  const denied = await forbidUnlessLeadAccess(user, P.LEADS_UPDATE, lead);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Додайте файл (поле file)" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  if (isExcelFile(file.name, mimeType)) {
    const draft = buildEstimateDraftFromExcelBuffer({
      fileBuffer,
      fileName: file.name,
    });
    if (draft.lines.length === 0) {
      return NextResponse.json(
        {
          error: "Не вдалося розпізнати позиції в Excel",
          details: draft.missing.join("; "),
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      draft,
      templateKey: null,
      source: { fileName: file.name, mode: "spreadsheet" },
    });
  }

  const extracted = await extractTextFromBuffer({
    buffer: fileBuffer,
    mimeType,
    fileName: file.name,
  });

  const isImage = mimeType.toLowerCase().startsWith("image/");
  const ai = await analyzeEstimateFromContent({
    fileName: file.name,
    extractedText: extracted.text,
    imageBase64: isImage ? fileBuffer.toString("base64") : null,
    imageMime: isImage ? mimeType : null,
  });

  if (!ai.result.lines.length || !ai.isProjectDocument) {
    return NextResponse.json(
      {
        error: "Не вдалося сформувати шаблон з файлу",
        details: ai.aiSummary ?? "Файл не схожий на проєктний документ",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    draft: ai.result,
    templateKey: ai.templateKey ?? null,
    source: { fileName: file.name, mode: extracted.mode },
  });
}
