import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  forbidUnlessLeadAccess,
  forbidUnlessPermission,
  requireSessionUser,
} from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { analyzeEstimateFromContent } from "@/lib/estimates/ai-estimate-from-file";
import { createOrForkLeadEstimateFromDraft } from "@/lib/estimates/create-lead-estimate-from-draft";
import {
  extractTextFromLeadPublicFile,
  readFileAsBase64,
} from "@/lib/estimates/lead-file-text-extract";
import {
  prisma,
  prismaCodegenIncludesEstimateLeadId,
} from "@/lib/prisma";

type Ctx = {
  params: Promise<{ leadId: string; attachmentId: string }>;
};

export async function POST(req: Request, ctx: Ctx) {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { error: "DATABASE_URL не задано" },
      { status: 503 },
    );
  }

  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;

  const { leadId, attachmentId } = await ctx.params;

  let body: { apply?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const apply = Boolean(body.apply);

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, ownerId: true, dealId: true },

    });

    if (!lead) {

      return NextResponse.json({ error: "Лід не знайдено" }, { status: 404 });

    }

    if (lead.dealId) {

      return NextResponse.json(

        { error: "Лід привʼязаний до угоди — прорахунок у картці угоди" },

        { status: 409 },

      );

    }



    const viewDenied = await forbidUnlessLeadAccess(user, P.LEADS_VIEW, lead);

    if (viewDenied) return viewDenied;



    if (apply) {
      if (!prismaCodegenIncludesEstimateLeadId()) {
        return NextResponse.json(
          { error: "Прорахунки по ліду недоступні (оновіть Prisma)" },
          { status: 503 },
        );
      }
      const permDenied = forbidUnlessPermission(user, P.ESTIMATES_CREATE);
      if (permDenied) return permDenied;
      const updateDenied = await forbidUnlessLeadAccess(
        user,
        P.LEADS_UPDATE,
        lead,
      );
      if (updateDenied) return updateDenied;
    }



    const att = await prisma.attachment.findFirst({

      where: {

        id: attachmentId,

        entityType: "LEAD",

        entityId: leadId,

        deletedAt: null,

      },

      select: { id: true, fileName: true, fileUrl: true, mimeType: true },

    });

    if (!att) {

      return NextResponse.json({ error: "Файл не знайдено" }, { status: 404 });

    }



    const extracted = await extractTextFromLeadPublicFile({

      publicPath: att.fileUrl,

      mimeType: att.mimeType,

    });



    let imageBase64: string | null = null;

    let imageMime: string | null = null;

    if (extracted.mode === "image") {

      imageMime = att.mimeType;

      try {

        imageBase64 = await readFileAsBase64(att.fileUrl);

      } catch {

        imageBase64 = null;

      }

    }



    const ai = await analyzeEstimateFromContent({

      fileName: att.fileName,

      extractedText: extracted.text,

      imageBase64,

      imageMime,

    });



    let appliedEstimateId: string | null = null;

    let estimateIdChanged = false;



    if (

      apply &&

      ai.result.lines.length > 0 &&

      ai.isProjectDocument

    ) {

      const cs = `Файл: ${att.fileName} · ${ai.aiSummary ?? "ШІ-прорахунок"}`;

      const created = await prisma.$transaction(async (tx) => {

        return createOrForkLeadEstimateFromDraft(tx, {

          leadId,

          userId: user.id,

          draftLines: ai.result.lines,

          templateKey: ai.templateKey,

          changeSummary: cs.slice(0, 500),

          notes: null,

        });

      });

      appliedEstimateId = created.id;

      estimateIdChanged = true;



      revalidatePath(`/leads/${leadId}`);

      revalidatePath(`/leads/${leadId}/estimate/${created.id}`);

      revalidatePath(`/leads/${leadId}/files`);

    }



    return NextResponse.json({

      ok: true,

      configured: ai.configured,

      aiSummary: ai.aiSummary,

      confidence: ai.confidence,

      isProjectDocument: ai.isProjectDocument,

      templateKey: ai.templateKey,

      draft: {

        lines: ai.result.lines,

        assumptions: ai.result.assumptions,

        missing: ai.result.missing,

      },

      appliedEstimateId,

      estimateIdChanged,

      extractMode: extracted.mode,

    });

  } catch (e) {

     

    console.error("[POST analyze-estimate]", e);

    return NextResponse.json(

      { error: "Помилка аналізу файлу" },

      { status: 500 },

    );

  }

}

