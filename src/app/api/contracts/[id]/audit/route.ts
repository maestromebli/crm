import { NextResponse } from "next/server";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_VIEW);
  if (denied) return denied;

  const { id } = await params;
  const data = await prisma.enverContractAuditEvent.findMany({
    where: { contractId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(data);
}
