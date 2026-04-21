import { NextRequest, NextResponse } from "next/server";
import { sendForSignatureSchema } from "@/features/contracts/schemas/contract.schema";
import { sendContractForSignature } from "@/features/contracts/services/send-contract-for-signature";
import { forbidUnlessPermission, requireSessionUser } from "@/lib/authz/api-guard";
import { P } from "@/lib/authz/permissions";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSessionUser();
  if (user instanceof NextResponse) return user;
  const denied = forbidUnlessPermission(user, P.CONTRACTS_UPDATE);
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const parsed = sendForSignatureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await sendContractForSignature({
      prisma,
      contractId: id,
      provider: parsed.data.provider,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SEND_FOR_SIGNATURE_FAILED" },
      { status: 400 },
    );
  }
}
