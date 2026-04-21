import { NextResponse } from "next/server";
import { cancelSigningSession } from "@/features/contracts/services/cancel-signing-session";
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
    const result = await cancelSigningSession({ prisma, contractId: id });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CANCEL_SESSION_FAILED" },
      { status: 400 },
    );
  }
}
