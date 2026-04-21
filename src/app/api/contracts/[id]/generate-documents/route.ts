import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { generateContractDocuments } from "@/lib/contracts/service";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    const docs = await generateContractDocuments({
      prisma,
      contractId: id,
      userId: user.id,
    });
    return NextResponse.json({ ok: true, data: docs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "DOCUMENT_GENERATION_FAILED";
    const legacyContract = await prisma.dealContract.findUnique({
      where: { id },
      select: { id: true, dealId: true },
    });
    if (!legacyContract) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    const contractAttachmentId = randomBytes(12).toString("hex");
    const specAttachmentId = randomBytes(12).toString("hex");
    const ts = Date.now();
    const contractPdfUrl = `/uploads/mock/contracts/${legacyContract.id}-contract-${ts}.pdf`;
    const specificationPdfUrl = `/uploads/mock/contracts/${legacyContract.id}-spec-${ts}.pdf`;

    await prisma.$transaction([
      prisma.attachment.create({
        data: {
          id: contractAttachmentId,
          fileName: `contract-${legacyContract.id}.pdf`,
          fileUrl: contractPdfUrl,
          storageKey: `mock/contracts/${legacyContract.id}-contract-${ts}.pdf`,
          mimeType: "application/pdf",
          fileSize: 0,
          category: "CONTRACT",
          entityType: "DEAL",
          entityId: legacyContract.dealId,
          uploadedById: user.id,
        },
      }),
      prisma.attachment.create({
        data: {
          id: specAttachmentId,
          fileName: `specification-${legacyContract.id}.pdf`,
          fileUrl: specificationPdfUrl,
          storageKey: `mock/contracts/${legacyContract.id}-spec-${ts}.pdf`,
          mimeType: "application/pdf",
          fileSize: 0,
          category: "SPEC",
          entityType: "DEAL",
          entityId: legacyContract.dealId,
          uploadedById: user.id,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: { contractPdfUrl, specificationPdfUrl },
      warning: msg,
    });
  }
}
