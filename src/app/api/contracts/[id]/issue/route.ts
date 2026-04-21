import { NextRequest, NextResponse } from "next/server";
import { issueContract } from "@/features/contracts/services/issue-contract";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

function makeUpload(contractId: string) {
  return async (_fileName: string, _buffer: Buffer, _contentType: string) => {
    return `/api/contracts/${contractId}/artifacts/rendered-pdf`;
  };
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await params;
  try {
    const contract = await issueContract({
      prisma,
      contractId: id,
      upload: makeUpload(id),
    });
    return NextResponse.json(contract);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "ISSUE_CONTRACT_FAILED" },
      { status: 400 },
    );
  }
}
