import { NextResponse } from "next/server";
import { resendSignLink } from "@/features/contracts/services/resend-sign-link";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await params;
  try {
    const result = await resendSignLink({ prisma, contractId: id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "RESEND_LINK_FAILED" },
      { status: 400 },
    );
  }
}
