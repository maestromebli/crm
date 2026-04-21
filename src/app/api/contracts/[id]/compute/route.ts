import { NextResponse } from "next/server";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_VIEW);
  if (denied) return denied;

  const { id } = await params;
  const contract = await prisma.enverContract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "CONTRACT_NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    payloadJson: contract.payloadJson,
    pricingSnapshotJson: contract.pricingSnapshotJson,
  });
}
