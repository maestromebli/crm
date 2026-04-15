import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionUser, forbidUnlessPermission } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { generateContractDocuments } from "@/lib/contracts/service";

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
    const status = msg === "CONTRACT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
