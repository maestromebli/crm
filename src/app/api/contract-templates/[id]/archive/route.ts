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
  const denied = forbidUnlessPermission(user, P.SETTINGS_MANAGE);
  if (denied) return denied;

  const { id } = await params;
  const updated = await prisma.enverContractTemplate.update({
    where: { id },
    data: { status: "ARCHIVED", isActive: false },
  });
  return NextResponse.json(updated);
}
